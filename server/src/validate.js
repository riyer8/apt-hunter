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
