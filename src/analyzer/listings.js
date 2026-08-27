import {
  emptyToNull,
  extractFactsFromText,
  parseApartmentName,
  parseBathrooms,
  parseBedrooms,
  parseBedsBaths,
  parseDate,
  parseFloorPlan,
  parsePrice,
  parseSqft,
  parseUnit,
  parseUrl,
} from "./values.js";

export const STRATEGY_RANK = {
  json: 1,
  jsData: 2,
  html: 3,
  text: 4,
};

export const CONFIDENCE = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const LISTING_FIELDS = [
  "unit",
  "price",
  "bedrooms",
  "bathrooms",
  "sqft",
  "availableDate",
  "floorPlan",
  "listingUrl",
];

export function createListing() {
  return {
    id: null,
    apartmentName: null,
    unit: null,
    price: null,
    bedrooms: null,
    bathrooms: null,
    sqft: null,
    availableDate: null,
    floorPlan: null,
    listingUrl: null,
    sourceUrl: null,
    firstSeen: null,
    lastSeen: null,
    confidence: CONFIDENCE.LOW,
    source: null,
  };
}

export function identityKey({ apartmentName, unit, floorPlan }) {
  const apt = slug(apartmentName);
  const unitId = slug(unit);
  const plan = slug(floorPlan);
  if (!apt) return null;
  if (unitId) return `${apt}|unit:${unitId}`;
  if (plan) return `${apt}|plan:${plan}`;
  return null;
}

export function listingId(parts) {
  const key = identityKey(parts);
  if (!key) return null;
  return `lst_${hash(key)}`;
}

export function populatedListingFields(listing) {
  return LISTING_FIELDS.filter((field) => listing[field] != null && listing[field] !== "");
}

export function scoreConfidence(listing, source) {
  if (source === "text") return CONFIDENCE.LOW;

  const hasUnit = listing.unit != null;
  const hasPrice = listing.price != null;
  const hasUrl = listing.listingUrl != null;
  const filled = populatedListingFields(listing).length;

  if (hasUnit && hasPrice && hasUrl && filled >= 4) return CONFIDENCE.HIGH;
  if (hasUnit && hasPrice) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

export function candidateToListing(candidate, { apartmentName, sourceUrl, now }) {
  const raw = candidate.record || {};
  const combinedText =
    typeof raw.text === "string" && raw.text.trim()
      ? raw.text
      : Object.values(raw)
          .filter((value) => typeof value === "string")
          .join(" ");
  const textFacts = extractFactsFromText(combinedText);
  const bedsBaths = parseBedsBaths(combinedText);

  const listing = createListing();
  listing.apartmentName = parseApartmentName(apartmentName) || parseApartmentName(raw.apartmentName);
  listing.unit = parseUnit(pick(raw, ["unit", "unitNumber", "unitNo", "apt"])) || textFacts.unit;
  listing.price = firstNumber(parsePrice(pick(raw, ["price", "rent", "monthlyRent", "minRent"])), textFacts.price);
  listing.bedrooms = firstNumber(
    parseBedrooms(pick(raw, ["bedrooms", "beds", "bed", "numberOfBedrooms"])),
    bedsBaths.bedrooms,
    textFacts.bedrooms,
  );
  listing.bathrooms = firstNumber(
    parseBathrooms(pick(raw, ["bathrooms", "baths", "bath", "numberOfBathroomsTotal"])),
    bedsBaths.bathrooms,
    textFacts.bathrooms,
  );
  listing.sqft = firstNumber(parseSqft(pick(raw, ["sqft", "squareFeet", "floorSize", "size"])), textFacts.sqft);
  listing.availableDate =
    parseDate(pick(raw, ["availableDate", "availableOn", "available", "availability"])) || textFacts.availableDate;
  listing.floorPlan =
    parseFloorPlan(pick(raw, ["floorPlan", "floorPlanName", "plan", "model"])) ||
    textFacts.floorPlan ||
    parseFloorPlan(combinedText);

  if (!listing.unit && !listing.floorPlan && listing.bedrooms != null) {
    listing.floorPlan =
      listing.bedrooms === 0
        ? "Studio"
        : `${listing.bedrooms} Bed${listing.bathrooms != null ? ` ${listing.bathrooms} Bath` : ""}`;
  }
  listing.listingUrl = parseUrl(pick(raw, ["url", "href", "listingUrl", "applyUrl"]), sourceUrl);
  listing.sourceUrl = sourceUrl || null;
  listing.source = candidate.source;
  listing.firstSeen = now;
  listing.lastSeen = now;
  listing.id = listingId(listing);

  if (!listing.id) return null;

  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].filter(
    (field) => listing[field] != null,
  );
  if (facts.length === 0) return null;

  listing.confidence = scoreConfidence(listing, candidate.source);
  return listing;
}

export function mergeListings(preferred, extra) {
  const merged = { ...preferred };
  for (const field of [
    "apartmentName",
    "unit",
    "price",
    "bedrooms",
    "bathrooms",
    "sqft",
    "availableDate",
    "floorPlan",
    "listingUrl",
    "sourceUrl",
  ]) {
    if (merged[field] == null && extra[field] != null) merged[field] = extra[field];
  }
  merged.firstSeen = earlier(preferred.firstSeen, extra.firstSeen);
  merged.lastSeen = extra.lastSeen || preferred.lastSeen;
  if ((STRATEGY_RANK[extra.source] || 99) < (STRATEGY_RANK[preferred.source] || 99)) {
    merged.source = extra.source;
  }
  merged.confidence = scoreConfidence(merged, merged.source);
  merged.id = listingId(merged) || preferred.id;
  return merged;
}

export function dedupeListings(listings) {
  const byId = new Map();
  const ordered = [...listings].sort(
    (left, right) => (STRATEGY_RANK[left.source] || 99) - (STRATEGY_RANK[right.source] || 99),
  );

  for (const listing of ordered) {
    const existing = byId.get(listing.id);
    if (!existing) {
      byId.set(listing.id, listing);
      continue;
    }
    byId.set(listing.id, mergeListings(existing, listing));
  }

  return [...byId.values()];
}

export function sortListings(listings) {
  return [...listings].sort((left, right) => {
    const leftLabel = String(left.unit || left.floorPlan || "");
    const rightLabel = String(right.unit || right.floorPlan || "");
    const byLabel = leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: "base" });
    if (byLabel !== 0) return byLabel;
    return (left.price || 0) - (right.price || 0);
  });
}

export function applyPreviousSightings(listings, previous = []) {
  const previousById = new Map((previous || []).map((item) => [item.id, item]));
  return listings.map((listing) => {
    const prior = previousById.get(listing.id);
    if (!prior) return listing;
    return {
      ...listing,
      firstSeen: prior.firstSeen || listing.firstSeen,
      lastSeen: listing.lastSeen,
    };
  });
}

function pick(raw, keys) {
  for (const key of keys) {
    const match = Object.entries(raw).find(([candidate]) => normalizeKey(candidate) === normalizeKey(key));
    if (match && match[1] != null && match[1] !== "") {
      if (typeof match[1] === "object" && match[1].value != null) return match[1].value;
      return match[1];
    }
  }
  return null;
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function firstNumber(...values) {
  for (const value of values) {
    if (value != null && value !== "") return value;
  }
  return null;
}

function slug(value) {
  if (value == null) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hash(value) {
  let total = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    total ^= value.charCodeAt(i);
    total = Math.imul(total, 16777619);
  }
  return (total >>> 0).toString(16);
}

function earlier(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return left < right ? left : right;
}

export function nullsToNull(listing) {
  const next = { ...listing };
  for (const [key, value] of Object.entries(next)) {
    next[key] = emptyToNull(value);
  }
  return next;
}
