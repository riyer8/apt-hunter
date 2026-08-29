import { STATUS, createApartment } from "@shared/schema.js";
import { SF_BUILDINGS } from "@shared/sfBuildings.js";
import { requestDevStart } from "@shared/devLauncher.js";

const STORAGE_KEY = "aptwatch.web.apartments";
const SOURCE_EXT = "aptwatch-extension";
const SOURCE_WEB = "aptwatch-web";
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

let bridgeState = null;
let bridgeConnected = false;
let bridgeGaveUp = false;
let pendingError = null;
let apiState = { ok: null, checkedAt: 0 };

function hasChromeStorage() {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.storage?.local && chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function getDataSource() {
  if (apiState.ok) return "api";
  if (hasChromeStorage() || bridgeConnected) return "extension";
  return "local";
}

function resetApiProbe() {
  apiState = { ok: null, checkedAt: 0 };
}

async function apiReady({ force = false } = {}) {
  if (!force && apiState.ok === true) return true;
  if (!force && apiState.ok === false && Date.now() - apiState.checkedAt < 4000) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 400);
    const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    apiState = { ok: response.ok, checkedAt: Date.now() };
  } catch {
    apiState = { ok: false, checkedAt: Date.now() };
  }
  return apiState.ok;
}

async function apiRequest(path, { method = "GET", body, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `API request failed (${response.status})`);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. The scrape may still be running — refresh in a moment.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyLedger(listings, ledger) {
  return (listings || []).map((listing) => {
    const remembered = ledger?.[listing.id];
    if (!remembered) return listing;
    return {
      ...listing,
      firstSeen: listing.firstSeen || remembered.firstSeen || listing.firstSeen,
      previousPrice: listing.previousPrice ?? remembered.previousPrice ?? null,
    };
  });
}

function toDashboardApartments(apartments, ledger) {
  return (apartments || []).map((apartment) => ({
    ...createApartment(),
    ...apartment,
    location: apartment.location || null,
    lastChecked: apartment.lastChecked || apartment.analysis?.analyzedAt || null,
    listings: applyLedger(apartment.listings || [], ledger).map((listing) => ({
      ...listing,
      apartmentId: listing.apartmentId || apartment.id,
      apartmentName: listing.apartmentName || apartment.name,
      buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
    })),
  }));
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocal(apartments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apartments));
}

function requestBridge() {
  window.postMessage({ source: SOURCE_WEB, type: "GET" }, "*");
}

function requestExtensionSync() {
  if (typeof window === "undefined") return;
  window.postMessage({ source: SOURCE_WEB, type: "SYNC_FROM_BACKEND" }, "*");
}

/** Pull API apartments into chrome.storage so the extension popup stays in sync with the website. */
export function syncExtensionFromBackend() {
  if (hasChromeStorage()) {
    try {
      chrome.runtime.sendMessage({ type: "SYNC_FROM_BACKEND" });
    } catch {
      /* ignore */
    }
    return;
  }
  requestExtensionSync();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mirror extension popup startup: wait for the API, wake backend jobs, sync extension storage.
 */
export async function ensureBackendReady({ maxWaitMs = 30000 } = {}) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    resetApiProbe();
    if (await apiReady({ force: true })) {
      try {
        await apiRequest("/wake", { method: "POST", timeoutMs: 10000 });
      } catch {
        // Health succeeded; wake is best-effort.
      }
      requestExtensionSync();
      await waitForBridge(800);
      return true;
    }
    await requestDevStart();
    await sleep(1000);
  }
  syncExtensionFromBackend();
  await waitForBridge(800);
  return false;
}

function waitForEvent(name, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener(name, onEvent);
      resolve();
    }, timeoutMs);
    function onEvent() {
      clearTimeout(timer);
      window.removeEventListener(name, onEvent);
      resolve();
    }
    window.addEventListener(name, onEvent);
  });
}

function waitForBridge(timeoutMs) {
  if (bridgeConnected) return Promise.resolve(bridgeState);
  if (bridgeGaveUp) return Promise.resolve(null);
  requestBridge();
  return waitForEvent("aptwatch:apartments-changed", timeoutMs).then(() => {
    if (!bridgeConnected) bridgeGaveUp = true;
    return bridgeState;
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== SOURCE_EXT) return;
    if (message.type === "STATE") {
      bridgeConnected = true;
      bridgeState = message.payload || {};
      window.dispatchEvent(new Event("aptwatch:apartments-changed"));
    }
    if (message.type === "ERROR") {
      pendingError = message.error || "Something went wrong.";
      window.dispatchEvent(new Event("aptwatch:apartments-error"));
    }
  });
}

function makeApartment(name, url) {
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  return {
    ...createApartment(),
    id: crypto.randomUUID(),
    name: name?.trim() || hostname,
    url: url.trim(),
    location: null,
    dateAdded: new Date().toISOString(),
    status: STATUS.NOT_ANALYZED,
    lastChecked: null,
    listings: [],
  };
}

export async function listApartments() {
  if (await apiReady()) {
    return apiRequest("/apartments");
  }
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(["apartments", "listingLedger"]);
    return toDashboardApartments(data.apartments || [], data.listingLedger || {});
  }
  await waitForBridge(400);
  if (bridgeConnected) {
    return toDashboardApartments(bridgeState?.apartments || [], bridgeState?.listingLedger || {});
  }
  return clone(readLocal());
}

export async function getUserPreferences() {
  if (await apiReady()) {
    try {
      return await apiRequest("/preferences");
    } catch {
      return null;
    }
  }
  try {
    const raw = localStorage.getItem("aptwatch.userPreferences");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveUserPreferences(prefs) {
  if (await apiReady()) return apiRequest("/preferences", { method: "PUT", body: prefs });
  localStorage.setItem("aptwatch.userPreferences", JSON.stringify(prefs));
  return prefs;
}

export async function listNotifications({ unread, pending, limit } = {}) {
  if (!(await apiReady())) return { notifications: [], unreadCount: 0 };
  const params = new URLSearchParams();
  if (unread) params.set("unread", "1");
  if (pending) params.set("pending", "1");
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiRequest(`/notifications${query ? `?${query}` : ""}`);
}

export async function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", { method: "POST" });
}

export async function deliverNotification(id) {
  return apiRequest(`/notifications/${id}/deliver`, { method: "POST" });
}

export async function getAlertPrefs(id) {
  return apiRequest(`/apartments/${id}/alerts`);
}

export async function saveAlertPrefs(id, prefs) {
  return apiRequest(`/apartments/${id}/alerts`, { method: "PUT", body: prefs });
}

export async function listChanges({ apartmentId, type, limit } = {}) {
  if (await apiReady()) {
    const params = new URLSearchParams();
    if (apartmentId) params.set("apartmentId", apartmentId);
    if (type) params.set("type", type);
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return apiRequest(`/changes${query ? `?${query}` : ""}`);
  }

  const { synthesizeChanges } = await import("../lib/changes.js");
  const apartments = await listApartments();
  return synthesizeChanges(apartments, { apartmentId, type });
}

export async function getApartment(id) {
  return (await listApartments()).find((item) => item.id === id) || null;
}

export async function populateSfBuildings() {
  if (await apiReady()) {
    const apartments = await apiRequest("/apartments/populate-sf", { method: "POST" });
    syncExtensionFromBackend();
    return apartments;
  }

  const existing = await listApartments();
  for (const apartment of existing) {
    await removeApartment(apartment.id);
  }

  const created = [];
  for (const building of SF_BUILDINGS) {
    created.push(await addApartment({ name: building.name, url: building.availabilityUrl }));
  }
  return created;
}

export async function addApartment({ name, url }) {
  if (await apiReady()) {
    const created = await apiRequest("/apartments", { method: "POST", body: { name, url } });
    syncExtensionFromBackend();
    return created;
  }
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get("apartments");
    const apartments = data.apartments || [];
    const normalized = url.trim().replace(/\/+$/, "").toLowerCase();
    if (
      apartments.some((item) => String(item.url || "").trim().replace(/\/+$/, "").toLowerCase() === normalized)
    ) {
      throw new Error("This URL is already being monitored.");
    }
    const apartment = makeApartment(name, url);
    apartments.push(apartment);
    await chrome.storage.local.set({ apartments });
    return toDashboardApartments([apartment], {})[0];
  }

  if (bridgeConnected || (await waitForBridge(400), bridgeConnected)) {
    pendingError = null;
    window.postMessage({ source: SOURCE_WEB, type: "ADD", name, url }, "*");
    await Promise.race([
      waitForEvent("aptwatch:apartments-changed", 1500),
      waitForEvent("aptwatch:apartments-error", 1500),
    ]);
    if (pendingError) throw new Error(pendingError);
    const items = toDashboardApartments(bridgeState?.apartments || [], bridgeState?.listingLedger || {});
    return items.find((item) => item.url === url.trim()) || items[0];
  }

  const apartments = readLocal();
  const apartment = makeApartment(name, url);
  apartments.unshift(apartment);
  writeLocal(apartments);
  return clone(apartment);
}

export async function removeApartment(id) {
  if (await apiReady()) {
    await apiRequest(`/apartments/${id}`, { method: "DELETE" });
    syncExtensionFromBackend();
    return true;
  }
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(["apartments", "extractedListings"]);
    const apartments = (data.apartments || []).filter((item) => item.id !== id);
    const extracted = { ...(data.extractedListings || {}) };
    delete extracted[id];
    await chrome.storage.local.set({ apartments, extractedListings: extracted });
    return true;
  }

  if (bridgeConnected || (await waitForBridge(400), bridgeConnected)) {
    window.postMessage({ source: SOURCE_WEB, type: "REMOVE", id }, "*");
    await waitForEvent("aptwatch:apartments-changed", 1500);
    return true;
  }

  writeLocal(readLocal().filter((item) => item.id !== id));
  return true;
}

export async function setMonitorState(id, state) {
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}/monitor`, { method: "POST", body: { state } });
    syncExtensionFromBackend();
    return result;
  }
  throw new Error("Start and pause monitoring need the API.");
}

export async function setApartmentSelection(id, patch) {
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}/selection`, { method: "POST", body: patch });
    syncExtensionFromBackend();
    return result;
  }
  const apartments = await listApartments();
  const index = apartments.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("Apartment not found.");
  const next = applySelectionPatch(apartments[index], patch);
  apartments[index] = next;
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get("apartments");
    const stored = (data.apartments || []).map((item) => (item.id === id ? { ...item, ...next } : item));
    await chrome.storage.local.set({ apartments: stored });
    window.dispatchEvent(new Event("aptwatch:apartments-changed"));
    return next;
  }
  if (bridgeConnected || (await waitForBridge(400), bridgeConnected)) {
    window.postMessage({ source: SOURCE_WEB, type: "UPDATE_SELECTION", apartmentId: id, patch }, "*");
    await waitForEvent("aptwatch:apartments-changed", 1500);
    return next;
  }
  writeLocal(apartments);
  window.dispatchEvent(new Event("aptwatch:apartments-changed"));
  return next;
}

export async function setListingSelection(id, patch) {
  if (await apiReady()) {
    const result = await apiRequest(`/listings/${id}/selection`, { method: "POST", body: patch });
    syncExtensionFromBackend();
    return result;
  }
  const updated = await updateStoredListingSelection(id, patch);
  if (!updated) throw new Error("Listing not found.");
  return updated;
}

function applySelectionPatch(target, patch) {
  const next = { ...target };
  if (patch.favorite !== undefined) next.isFavorite = patch.favorite;
  if (patch.watchlisted !== undefined) next.isWatchlisted = patch.watchlisted;
  if (patch.discarded !== undefined) next.isDiscarded = patch.discarded;
  return next;
}

async function updateStoredListingSelection(id, patch) {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(["apartments", "extractedListings"]);
    let updated = null;
    const apartments = (data.apartments || []).map((apartment) => {
      const listings = (apartment.listings || []).map((listing) => {
        if (listing.id !== id) return listing;
        updated = applySelectionPatch(listing, patch);
        return updated;
      });
      return listings === apartment.listings ? apartment : { ...apartment, listings };
    });
    const extracted = { ...(data.extractedListings || {}) };
    for (const [aptId, listings] of Object.entries(extracted)) {
      const nextListings = listings.map((listing) => {
        if (listing.id !== id) return listing;
        updated = applySelectionPatch(listing, patch);
        return updated;
      });
      if (nextListings !== listings) extracted[aptId] = nextListings;
    }
    if (!updated) return null;
    await chrome.storage.local.set({ apartments, extractedListings: extracted });
    window.dispatchEvent(new Event("aptwatch:apartments-changed"));
    return updated;
  }

  if (bridgeConnected || (await waitForBridge(400), bridgeConnected)) {
    window.postMessage({ source: SOURCE_WEB, type: "UPDATE_SELECTION", listingId: id, patch }, "*");
    await waitForEvent("aptwatch:apartments-changed", 1500);
    for (const apartment of (await listApartments())) {
      const listing = (apartment.listings || []).find((item) => item.id === id);
      if (listing) return listing;
    }
    return null;
  }

  const apartments = readLocal();
  let updated = null;
  const nextApartments = apartments.map((apartment) => {
    const listings = (apartment.listings || []).map((listing) => {
      if (listing.id !== id) return listing;
      updated = applySelectionPatch(listing, patch);
      return updated;
    });
    return listings === apartment.listings ? apartment : { ...apartment, listings };
  });
  if (!updated) return null;
  writeLocal(nextApartments);
  window.dispatchEvent(new Event("aptwatch:apartments-changed"));
  return updated;
}

export async function analyzeApartment(apartment) {
  const id = apartment?.id || apartment;
  const url = apartment?.url;
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}/scrape-now`, { method: "POST", timeoutMs: 120000 });
    syncExtensionFromBackend();
    return result;
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "ANALYZE_APARTMENT", id, url }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.ok) resolve(response.result);
        else reject(new Error(response?.error || "Analyze failed."));
      });
    });
  }
  if (bridgeConnected || (await waitForBridge(400), bridgeConnected)) {
    pendingError = null;
    window.postMessage({ source: SOURCE_WEB, type: "ANALYZE", id, url }, "*");
    await Promise.race([
      waitForEvent("aptwatch:apartments-changed", 120000),
      waitForEvent("aptwatch:apartments-error", 120000),
    ]);
    if (pendingError) throw new Error(pendingError);
    return (await listApartments()).find((item) => item.id === id) || null;
  }
  throw new Error("Analyze needs the API or extension.");
}

export async function scrapeNow(id) {
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}/scrape-now`, { method: "POST", timeoutMs: 120000 });
    syncExtensionFromBackend();
    return result;
  }
  throw new Error("Scrape Now needs the API.");
}

export async function listScrapeHistory(id) {
  if (await apiReady()) {
    return apiRequest(`/apartments/${id}/scrape-history`);
  }
  return [];
}

export async function reanalyzeBuilding(id) {
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}/building-profile/reanalyze`, { method: "POST" });
    syncExtensionFromBackend();
    return result;
  }
  throw new Error("Re-analyze Building needs the API and an OpenAI key.");
}

export async function updateApartment(id, patch) {
  if (await apiReady()) {
    const result = await apiRequest(`/apartments/${id}`, { method: "PATCH", body: patch });
    syncExtensionFromBackend();
    return result;
  }

  const apartments = readLocal();
  let updated = null;
  const next = apartments.map((apartment) => {
    if (apartment.id !== id) return apartment;
    updated = {
      ...apartment,
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.url != null ? { url: patch.url } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
    };
    return updated;
  });
  if (!updated) return null;
  writeLocal(next);
  window.dispatchEvent(new Event("aptwatch:apartments-changed"));
  return { apartment: updated, refreshed: { profile: false, availabilities: false } };
}

export function persistUiPrefs(patch) {
  if (hasChromeStorage()) {
    chrome.storage.local.get("aptwatchUi").then((result) => {
      chrome.storage.local.set({
        aptwatchUi: { ...(result.aptwatchUi || {}), ...patch },
      });
    });
    return;
  }
  if (bridgeConnected) {
    window.postMessage({ source: SOURCE_WEB, type: "SAVE_UI", patch }, "*");
  }
}
