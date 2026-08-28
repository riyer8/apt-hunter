export function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function canonicalUrl(value) {
  const parsed = new URL(value.trim());
  parsed.hash = "";
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`.toLowerCase();
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export { listingIdentityKey } from "./identity.js";

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body?.[field] == null || body[field] === "");
  if (missing.length) {
    const error = new Error(`Missing ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

export function parseApartmentInput(body) {
  const name = String(body?.name || "").trim();
  const url = String(body?.url || body?.source_url || "").trim();
  const location = body?.location == null || body.location === "" ? null : String(body.location).trim();

  if (!name || name.length > 120) {
    const error = new Error("Enter an apartment name (1–120 characters).");
    error.status = 400;
    throw error;
  }
  if (!isValidHttpUrl(url)) {
    const error = new Error("Enter a valid http:// or https:// URL.");
    error.status = 400;
    throw error;
  }

  return { name, url, canonicalUrl: canonicalUrl(url), location };
}

export function parseMonitorState(body) {
  const state = String(body?.state || body?.monitorState || "").toLowerCase();
  if (state !== "active" && state !== "paused") {
    const error = new Error("state must be active or paused.");
    error.status = 400;
    throw error;
  }
  return state;
}

export function parseScrapeInput(body) {
  const outcome = String(body?.outcome || body?.status || "").toUpperCase();
  const allowed = new Set(["SUCCESS", "PARTIAL", "FAILED"]);
  if (!allowed.has(outcome)) {
    const error = new Error("outcome must be SUCCESS, PARTIAL, or FAILED.");
    error.status = 400;
    throw error;
  }

  const listings = Array.isArray(body?.listings) ? body.listings.slice(0, 150) : [];
  if (outcome !== "FAILED" && !Array.isArray(body?.listings)) {
    const error = new Error("listings must be an array of extracted units.");
    error.status = 400;
    throw error;
  }

  return {
    outcome,
    listings,
    extractionMethod: body?.extractionMethod || body?.extraction_method || null,
    errorMessage: body?.errorMessage || body?.error_message || null,
    startedAt: body?.startedAt || null,
  };
}

export function parseUserPrefs(body) {
  const bedrooms = Array.isArray(body?.bedrooms)
    ? body.bedrooms.map(Number).filter((value) => [0, 1, 2, 3].includes(value))
    : [];
  const features = (list) =>
    (Array.isArray(list) ? list : [])
      .map((item) => String(item))
      .filter((item) =>
        [
          "laundry",
          "parking",
          "balcony",
          "gym",
          "pool",
          "airConditioning",
          "dishwasher",
          "elevator",
          "furnished",
        ].includes(item),
      );
  const neighborhoods = (Array.isArray(body?.preferredNeighborhoods) ? body.preferredNeighborhoods : [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20);
  const hard = body?.hard && typeof body.hard === "object" ? body.hard : {};

  return {
    maxRent: emptyNumber(body?.maxRent),
    bedrooms,
    minBathrooms: emptyNumber(body?.minBathrooms),
    minSqft: emptyNumber(body?.minSqft),
    maxSqft: emptyNumber(body?.maxSqft),
    moveInEarliest: body?.moveInEarliest || null,
    moveInLatest: body?.moveInLatest || null,
    requiredFeatures: features(body?.requiredFeatures),
    preferredFeatures: features(body?.preferredFeatures).filter(
      (id) => !features(body?.requiredFeatures).includes(id),
    ),
    preferredNeighborhoods: neighborhoods,
    hard: {
      maxRent: hard.maxRent !== false,
      bedrooms: hard.bedrooms !== false,
      bathrooms: hard.bathrooms !== false,
      minSqft: hard.minSqft !== false,
      maxSqft: hard.maxSqft === true,
      moveIn: hard.moveIn !== false,
      requiredFeatures: hard.requiredFeatures !== false,
      neighborhoods: hard.neighborhoods === true,
    },
    matchAlerts: body?.matchAlerts === true,
  };
}

export function parseProfile(body, index = 0) {
  const parsed = parseUserPrefs(body);
  const name = String(body?.name || `Search ${index + 1}`)
    .trim()
    .slice(0, 80);
  return {
    id: isUuid(body?.id) ? body.id : null,
    name: name || `Search ${index + 1}`,
    maxRent: parsed.maxRent,
    bedrooms: parsed.bedrooms,
    minBathrooms: parsed.minBathrooms,
    minSqft: parsed.minSqft,
    maxSqft: parsed.maxSqft,
    moveInEarliest: parsed.moveInEarliest,
    moveInLatest: parsed.moveInLatest,
    requiredFeatures: parsed.requiredFeatures,
    preferredFeatures: parsed.preferredFeatures,
    preferredNeighborhoods: parsed.preferredNeighborhoods,
    hard: parsed.hard,
  };
}

export function parsePreferenceBundle(body) {
  if (Array.isArray(body?.profiles)) {
    return {
      matchAlerts: body.matchAlerts === true,
      profiles: body.profiles.filter(Boolean).slice(0, 12).map((item, index) => parseProfile(item, index)),
    };
  }
  return {
    matchAlerts: body?.matchAlerts === true,
    profiles: [parseProfile(body || {}, 0)],
  };
}

function emptyNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseAlertPrefs(body) {
  return {
    newListings: body?.newListings !== false,
    priceDrops: body?.priceDrops !== false,
    priceIncreases: body?.priceIncreases === true,
    availabilityChanges: body?.availabilityChanges !== false,
    maxRent: body?.maxRent === "" || body?.maxRent == null ? null : Number(body.maxRent),
    minSqft: body?.minSqft === "" || body?.minSqft == null ? null : Number(body.minSqft),
    bedrooms: body?.bedrooms === "" || body?.bedrooms == null ? null : Number(body.bedrooms),
    bathrooms: body?.bathrooms === "" || body?.bathrooms == null ? null : Number(body.bathrooms),
    availableBy: body?.availableBy || null,
  };
}
