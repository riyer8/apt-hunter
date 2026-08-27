import { STATUS, createApartment } from "@shared/schema.js";
import { MOCK_APARTMENTS } from "../data/mockApartments.js";

const STORAGE_KEY = "aptwatch.web.apartments";
const SOURCE_EXT = "aptwatch-extension";
const SOURCE_WEB = "aptwatch-web";

let bridgeState = null;
let bridgeConnected = false;
let bridgeGaveUp = false;
let pendingError = null;

function hasChromeStorage() {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.storage?.local && chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function getDataSource() {
  if (hasChromeStorage() || bridgeConnected) return "extension";
  return "local";
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
  if (getDataSource() === "extension") return listApartments();
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
