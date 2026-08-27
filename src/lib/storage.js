const STORAGE_KEY = "apartments";
const LISTINGS_KEY = "extractedListings";

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
  const apartments = await getApartments();
  const apartment = {
    id: crypto.randomUUID(),
    name,
    url,
    dateAdded: new Date().toISOString(),
    status: STATUS.NOT_ANALYZED,
    listings: [],
  };
  apartments.push(apartment);
  await chrome.storage.local.set({ [STORAGE_KEY]: apartments });
  return apartment;
}

export async function removeApartment(id) {
  const apartments = (await getApartments()).filter((item) => item.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: apartments });
  await removeExtractedListings(id);
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

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}
