import {
  emptyToNull,
  extractFactsFromText,
  looksLikeDate,
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
  unwrapScalar,
} from "./values.js";

export const STRATEGY_RANK = {
  jsonLd: 1,
  json: 2,
  jsData: 3,
  html: 4,
  text: 5,
  api: 99,
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
    sources: [],
    evidence: {},
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

export function candidateToListing(candidate, context) {
  return convertCandidate(candidate, context).listing;
}

export function convertCandidate(candidate, { apartmentName, sourceUrl, now }) {
  const raw = candidate.record || {};
  const selector = raw._selector || null;
  const method = raw._method || null;
  const combinedText =
    typeof raw.text === "string" && raw.text.trim()
      ? raw.text
      : Object.entries(raw)
          .filter(([key, value]) => !key.startsWith("_") && typeof value === "string")
          .map(([, value]) => value)
          .join(" ");
  const textFacts = extractFactsFromText(combinedText);
  const bedsBaths = parseBedsBaths(combinedText);
  const snippet = clipEvidence(combinedText);

  const listing = createListing();
  listing.apartmentName = parseApartmentName(apartmentName) || parseApartmentName(raw.apartmentName);
  listing.sourceUrl = sourceUrl || null;
  listing.source = candidate.source;
  listing.sources = [candidate.source].filter(Boolean);
  listing.firstSeen = now;
  listing.lastSeen = now;

  assignField(listing, "unit", parseUnit(pick(raw, ["unit", "unitNumber", "unitNo", "unitId", "unitName", "apt"])), {
    source: candidate.source,
    origin: "record",
    selector,
    method,
    snippet,
    fallback: textFacts.unit,
  });
  if (listing.unit == null && textFacts.unit) {
    assignField(listing, "unit", textFacts.unit, {
      source: candidate.source,
      origin: "text",
      selector,
      method,
      snippet,
    });
  }

  assignField(
    listing,
    "price",
    firstNumber(
      parsePrice(pick(raw, ["price", "rent", "monthlyRent", "minRent", "startingAtPricesUnfurnished", "lowestPrice"])),
    ),
    {
      source: candidate.source,
      origin: "record",
      selector,
      method,
      snippet,
      fallback: textFacts.price,
    },
  );
  if (listing.price == null && textFacts.price != null) {
    assignField(listing, "price", textFacts.price, {
      source: candidate.source,
      origin: "text",
      selector,
      method,
      snippet,
    });
  }

  assignField(
    listing,
    "bedrooms",
    firstNumber(parseBedrooms(pick(raw, ["bedrooms", "beds", "bed", "bedroomNumber", "numberOfBedrooms"]))),
    {
      source: candidate.source,
      origin: "record",
      selector,
      method,
      snippet,
      fallback: firstNumber(bedsBaths.bedrooms, textFacts.bedrooms),
    },
  );
  if (listing.bedrooms == null) {
    const beds = firstNumber(bedsBaths.bedrooms, textFacts.bedrooms);
    if (beds != null) {
      assignField(listing, "bedrooms", beds, {
        source: candidate.source,
        origin: "text",
        selector,
        method,
        snippet,
      });
    }
  }

  assignField(
    listing,
    "bathrooms",
    firstNumber(parseBathrooms(pick(raw, ["bathrooms", "baths", "bath", "bathroomNumber", "numberOfBathroomsTotal"]))),
    {
      source: candidate.source,
      origin: "record",
      selector,
      method,
      snippet,
      fallback: firstNumber(bedsBaths.bathrooms, textFacts.bathrooms),
    },
  );
  if (listing.bathrooms == null) {
    const baths = firstNumber(bedsBaths.bathrooms, textFacts.bathrooms);
    if (baths != null) {
      assignField(listing, "bathrooms", baths, {
        source: candidate.source,
        origin: "text",
        selector,
        method,
        snippet,
      });
    }
  }

  assignField(listing, "sqft", firstNumber(parseSqft(pick(raw, ["sqft", "squareFeet", "floorSize", "size"]))), {
    source: candidate.source,
    origin: "record",
    selector,
    method,
    snippet,
    fallback: textFacts.sqft,
  });
  if (listing.sqft == null && textFacts.sqft != null) {
    assignField(listing, "sqft", textFacts.sqft, {
      source: candidate.source,
      origin: "text",
      selector,
      method,
      snippet,
    });
  }

  assignField(
    listing,
    "availableDate",
    parseDate(
      pick(raw, [
        "availableDate",
        "availableDateUnfurnished",
        "availableOn",
        "available",
        "availability",
        "moveInDate",
      ]),
    ),
    {
      source: candidate.source,
      origin: "record",
      selector,
      method,
      snippet,
      fallback: textFacts.availableDate,
      ambiguous: false,
    },
  );
  if (listing.availableDate == null && textFacts.availableDate) {
    assignField(listing, "availableDate", textFacts.availableDate, {
      source: candidate.source,
      origin: "text",
      selector,
      method,
      snippet,
    });
  }
  if (listing.availableDate && dateLooksAmbiguous(listing.availableDate) && listing.evidence.availableDate) {
    listing.evidence.availableDate.ambiguous = true;
  }

  assignField(listing, "floorPlan", parseFloorPlan(pick(raw, ["floorPlan", "floorPlanName", "plan", "model"])), {
    source: candidate.source,
    origin: "record",
    selector,
    method,
    snippet,
    fallback: textFacts.floorPlan || parseFloorPlan(combinedText),
  });
  if (listing.floorPlan == null) {
    const plan = textFacts.floorPlan || parseFloorPlan(combinedText);
    if (plan) {
      assignField(listing, "floorPlan", plan, {
        source: candidate.source,
        origin: "text",
        selector,
        method,
        snippet,
      });
    }
  }

  if (!listing.unit && !listing.floorPlan && listing.bedrooms != null) {
    const inferred =
      listing.bedrooms === 0
        ? "Studio"
        : `${listing.bedrooms} Bed${listing.bathrooms != null ? ` ${listing.bathrooms} Bath` : ""}`;
    assignField(listing, "floorPlan", inferred, {
      source: candidate.source,
      origin: "inferred",
      selector,
      method,
      snippet,
      inferred: true,
      ambiguous: true,
    });
  }

  assignField(listing, "listingUrl", parseUrl(pick(raw, ["url", "href", "listingUrl", "applyUrl"]), sourceUrl), {
    source: candidate.source,
    origin: "record",
    selector,
    method,
    snippet,
  });

  listing.id = listingId(listing);

  if (!listing.id) {
    return { listing: null, reason: "no identity (need a unit number or floor plan)", snippet };
  }
  if (isJunkListing(listing)) {
    return { listing: null, reason: "rejected as junk or marketing copy", snippet };
  }

  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].filter(
    (field) => listing[field] != null,
  );
  if (facts.length === 0) {
    return { listing: null, reason: "no price, beds, baths, sqft, or date", snippet };
  }

  listing.confidence = scoreConfidence(listing, candidate.source);
  return { listing, reason: null, snippet };
}

function assignField(listing, field, value, meta) {
  if (value == null || value === "") return;
  listing[field] = value;
  listing.evidence[field] = {
    value,
    source: meta.source,
    origin: meta.origin,
    method: meta.method || null,
    selector: meta.selector || null,
    snippet: meta.origin === "text" ? meta.snippet || clipEvidence(value) : clipEvidence(value),
    ambiguous: Boolean(meta.ambiguous),
    inferred: Boolean(meta.inferred),
  };
}

function dateLooksAmbiguous(value) {
  if (value == null || value === "now") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  return true;
}

function clipEvidence(value) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function mergeListings(preferred, extra) {
  const merged = { ...preferred, evidence: { ...(preferred.evidence || {}) } };
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
    if (merged[field] == null && extra[field] != null) {
      merged[field] = extra[field];
      if (extra.evidence?.[field]) merged.evidence[field] = extra.evidence[field];
    }
  }
  merged.sources = [...new Set([...(preferred.sources || [preferred.source]), ...(extra.sources || [extra.source])])].filter(
    Boolean,
  );
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

export function preferUnitIdentities(listings) {
  const hasUnits = listings.some((listing) => listing.unit);
  if (!hasUnits) return listings;
  return listings.filter((listing) => {
    if (listing.unit) return true;
    return !/^(studio|\d+\s+bed(?:room)?s?(?:\s+\d+(?:\.\d+)?\s+bath(?:room)?s?)?)$/i.test(
      listing.floorPlan || "",
    );
  });
}

export function collapsePrefixedUnits(listings) {
  const withUnits = listings.filter((listing) => listing.unit);
  const drop = new Set();
  const merged = new Map(listings.map((listing) => [listing.id, listing]));

  for (const longer of withUnits) {
    const shorter = withUnits.find((candidate) => {
      if (candidate === longer || !candidate.unit) return false;
      if (longer.unit.length <= candidate.unit.length) return false;
      if (!longer.unit.startsWith(candidate.unit)) return false;
      const remainder = longer.unit.slice(candidate.unit.length);
      return /^[A-Z][A-Z0-9]{0,3}$/i.test(remainder);
    });
    if (!shorter) continue;
    drop.add(longer.id);
    const current = merged.get(shorter.id) || shorter;
    merged.set(shorter.id, mergeListings(current, longer));
  }

  return listings.map((listing) => merged.get(listing.id) || listing).filter((listing) => !drop.has(listing.id));
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
      const unwrapped = unwrapScalar(match[1]);
      if (unwrapped != null && unwrapped !== "") return unwrapped;
    }
  }
  return null;
}

function isJunkListing(listing) {
  if (/^\[object /i.test(String(listing.unit || "")) || /^\[object /i.test(String(listing.floorPlan || ""))) {
    return true;
  }
  if (looksLikeDate(listing.unit) || looksLikeDate(listing.floorPlan)) {
    return true;
  }
  if (/listings?/i.test(String(listing.unit || "")) && !/\d/.test(String(listing.unit || ""))) {
    return true;
  }
  const url = listing.listingUrl || "";
  if (url.includes("#") && !listing.unit) {
    try {
      if (new URL(url).hash) return true;
    } catch {
      return true;
    }
  }
  const genericPlan = /^(studio|\d+\s+bed(?:room)?s?(?:\s+\d+(?:\.\d+)?\s+bath(?:room)?s?)?)$/i.test(
    listing.floorPlan || "",
  );
  if (!listing.unit && genericPlan && listing.sqft == null && listing.availableDate == null) {
    return true;
  }
  if (
    !listing.unit &&
    listing.bedrooms == null &&
    listing.bathrooms == null &&
    listing.sqft == null &&
    listing.price != null &&
    listing.availableDate
  ) {
    return true;
  }
  return false;
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
