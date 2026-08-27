import { STATUS, createApartment } from "@shared/schema.js";
import { MOCK_APARTMENTS } from "../data/mockApartments.js";

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

async function apiReady() {
  if (apiState.ok === true) return true;
  if (apiState.ok === false && Date.now() - apiState.checkedAt < 4000) return false;
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

async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }
  return data;
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
      apartmentName: listing.apartmentName || apartment.name,
    })),
  }));
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = clone(MOCK_APARTMENTS);
      writeLocal(seed);
      return seed;
    }
    return JSON.parse(raw);
  } catch {
    return clone(MOCK_APARTMENTS);
  }
}

function writeLocal(apartments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apartments));
}

function requestBridge() {
  window.postMessage({ source: SOURCE_WEB, type: "GET" }, "*");
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

export async function getApartment(id) {
  return (await listApartments()).find((item) => item.id === id) || null;
}

export async function addApartment({ name, url }) {
  if (await apiReady()) {
    return apiRequest("/apartments", { method: "POST", body: { name, url } });
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

export async function resetMockData() {
  if (getDataSource() !== "local") return listApartments();
  writeLocal(clone(MOCK_APARTMENTS));
  return clone(readLocal());
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
