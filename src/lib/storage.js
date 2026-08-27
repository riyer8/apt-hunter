import {
  apiCreateApartment,
  apiDeleteApartment,
  apiListApartments,
  apiReportScrape,
} from "./backend.js";

const STORAGE_KEY = "apartments";
const LISTINGS_KEY = "extractedListings";
const TEST_KEY = "lastTestExtraction";
const DIAGNOSTICS_KEY = "diagnosticsMode";
const LEDGER_KEY = "listingLedger";
const UI_KEY = "aptwatchUi";

export const STATUS = {
  NOT_ANALYZED: "Not analyzed",
  ANALYZING: "Analyzing…",
  SUCCESS: "Availability detected",
  PARTIAL: "Partial detection",
  FAILED: "Could not detect",
};

export async function getApartments() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

export async function getApartment(id) {
  return (await getApartments()).find((item) => item.id === id);
}

export async function addApartment({ name, url }) {
  let apartment = {
    id: crypto.randomUUID(),
    name,
    url,
    dateAdded: new Date().toISOString(),
    status: STATUS.NOT_ANALYZED,
    listings: [],
  };

  try {
    const remote = await apiCreateApartment({ name, url });
    apartment = {
      ...apartment,
      id: remote.id,
      name: remote.name || apartment.name,
      url: remote.url || apartment.url,
      location: remote.location || null,
      dateAdded: remote.dateAdded || apartment.dateAdded,
      status: remote.status || apartment.status,
      lastChecked: remote.lastChecked || null,
      listings: remote.listings || [],
    };
  } catch {
    // Keep the local copy until the backend is reachable.
  }

  const apartments = await getApartments();
  apartments.push(apartment);
  await chrome.storage.local.set({ [STORAGE_KEY]: apartments });
  return apartment;
}

export async function removeApartment(id) {
  const apartments = (await getApartments()).filter((item) => item.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: apartments });
  await removeExtractedListings(id);
  try {
    await apiDeleteApartment(id);
  } catch {
    // Local delete still stands if the API is down.
  }
}

export async function getExtractedListings(apartmentId) {
  const result = await chrome.storage.local.get(LISTINGS_KEY);
  const store = result[LISTINGS_KEY] ?? {};
  if (apartmentId) return store[apartmentId] ?? [];
  return store;
}

export async function saveExtractedListings(apartmentId, listings) {
  const result = await chrome.storage.local.get(LISTINGS_KEY);
  const store = { ...(result[LISTINGS_KEY] ?? {}) };
  store[apartmentId] = listings;
  await chrome.storage.local.set({ [LISTINGS_KEY]: store });
}

export async function removeExtractedListings(apartmentId) {
  const result = await chrome.storage.local.get(LISTINGS_KEY);
  const store = { ...(result[LISTINGS_KEY] ?? {}) };
  delete store[apartmentId];
  await chrome.storage.local.set({ [LISTINGS_KEY]: store });
}

export async function updateApartment(id, patch) {
  const apartments = await getApartments();
  const next = apartments.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next.find((item) => item.id === id);
}

export function isDuplicateUrl(apartments, url) {
  const normalized = normalizeUrl(url);
  return apartments.some((item) => normalizeUrl(item.url) === normalized);
}

export function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function displayName(apartment) {
  if (apartment.name?.trim()) {
    return apartment.name.trim();
  }

  try {
    return new URL(apartment.url).hostname.replace(/^www\./, "");
  } catch {
    return apartment.url;
  }
}

export async function getDiagnosticsMode() {
  const result = await chrome.storage.local.get(DIAGNOSTICS_KEY);
  return Boolean(result[DIAGNOSTICS_KEY]);
}

export async function setDiagnosticsMode(enabled) {
  await chrome.storage.local.set({ [DIAGNOSTICS_KEY]: Boolean(enabled) });
}

export async function getLastTestExtraction() {
  const result = await chrome.storage.local.get(TEST_KEY);
  return result[TEST_KEY] || null;
}

export async function saveLastTestExtraction(report) {
  await chrome.storage.local.set({ [TEST_KEY]: report });
}

export async function clearLastTestExtraction() {
  await chrome.storage.local.remove(TEST_KEY);
}

export async function getListingLedger() {
  const result = await chrome.storage.local.get(LEDGER_KEY);
  return result[LEDGER_KEY] ?? {};
}

export async function updateListingLedger(listings) {
  const ledger = await getListingLedger();
  for (const listing of listings || []) {
    if (!listing?.id) continue;
    const previous = ledger[listing.id] || {};
    const lastPrice = previous.lastPrice;
    ledger[listing.id] = {
      firstSeen: previous.firstSeen || listing.firstSeen || null,
      lastSeen: listing.lastSeen || previous.lastSeen || null,
      lastPrice: listing.price ?? lastPrice ?? null,
      previousPrice:
        listing.price != null && lastPrice != null && listing.price !== lastPrice
          ? lastPrice
          : previous.previousPrice ?? null,
    };
  }
  await chrome.storage.local.set({ [LEDGER_KEY]: ledger });
  return ledger;
}

export function applyLedgerToListings(listings, ledger) {
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

export async function getUiPrefs() {
  const result = await chrome.storage.local.get(UI_KEY);
  return result[UI_KEY] ?? {};
}

export async function saveUiPrefs(patch) {
  const current = await getUiPrefs();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [UI_KEY]: next });
  return next;
}

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export async function replaceApartmentId(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return newId;
  const apartments = await getApartments();
  await chrome.storage.local.set({
    [STORAGE_KEY]: apartments.map((item) => (item.id === oldId ? { ...item, id: newId } : item)),
  });
  const extracted = await getExtractedListings();
  if (extracted[oldId]) {
    extracted[newId] = extracted[oldId];
    delete extracted[oldId];
    await chrome.storage.local.set({ [LISTINGS_KEY]: extracted });
  }
  return newId;
}

export async function syncFromBackend() {
  const remote = await apiListApartments();
  if (!remote) return false;

  const local = await getApartments();
  const localByUrl = new Map(local.map((item) => [normalizeUrl(item.url), item]));
  const merged = remote.map((item) => {
    const existing = localByUrl.get(normalizeUrl(item.url));
    return {
      ...existing,
      ...item,
      analysis: existing?.analysis || null,
      listings: item.listings?.length ? item.listings : existing?.listings || [],
    };
  });
  const remoteUrls = new Set(remote.map((item) => normalizeUrl(item.url)));
  for (const item of local) {
    if (!remoteUrls.has(normalizeUrl(item.url))) merged.push(item);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return true;
}

export async function reportScrapeToBackend(apartment, payload) {
  try {
    let id = apartment.id;
    const remote = await apiCreateApartment({ name: apartment.name, url: apartment.url });
    if (remote?.id) id = await replaceApartmentId(apartment.id, remote.id);
    await apiReportScrape(id, payload);
    return id;
  } catch {
    return null;
  }
}
