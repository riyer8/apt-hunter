/**
 * Deterministic listing-to-preference matching.
 * YES / NO / UNKNOWN — never treat UNKNOWN as NO.
 */

export const FEATURES = [
  { id: "laundry", label: "In-unit laundry" },
  { id: "parking", label: "Parking" },
  { id: "balcony", label: "Balcony" },
  { id: "gym", label: "Gym" },
  { id: "pool", label: "Pool" },
  { id: "airConditioning", label: "Air conditioning" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "elevator", label: "Elevator" },
  { id: "furnished", label: "Furnished" },
];

export const FEATURE_IDS = FEATURES.map((item) => item.id);

export const ATTR = {
  YES: "YES",
  NO: "NO",
  UNKNOWN: "UNKNOWN",
};

export const DEFAULT_USER_PREFS = {
  id: null,
  name: "",
  maxRent: null,
  bedrooms: [],
  minBathrooms: null,
  minSqft: null,
  maxSqft: null,
  moveInEarliest: null,
  moveInLatest: null,
  requiredFeatures: [],
  preferredFeatures: [],
  preferredNeighborhoods: [],
  hard: {
    maxRent: true,
    bedrooms: true,
    bathrooms: true,
    minSqft: true,
    maxSqft: false,
    moveIn: true,
    requiredFeatures: true,
    neighborhoods: false,
  },
  matchAlerts: false,
};

export function defaultUserPrefs(overrides = {}) {
  const hard = { ...DEFAULT_USER_PREFS.hard, ...(overrides.hard || {}) };
  return { ...DEFAULT_USER_PREFS, ...overrides, hard };
}

export function featureLabel(id) {
  return FEATURES.find((item) => item.id === id)?.label || id;
}

export function normalizeAttr(value) {
  if (value === ATTR.YES || value === true || value === "true" || value === "yes") return ATTR.YES;
  if (value === ATTR.NO || value === false || value === "false" || value === "no") return ATTR.NO;
  return ATTR.UNKNOWN;
}

export function normalizeFeatures(incoming, previous = {}) {
  const merged = { ...(previous && typeof previous === "object" ? previous : {}) };
  if (incoming && typeof incoming === "object") {
    for (const [key, value] of Object.entries(incoming)) {
      if (!FEATURE_IDS.includes(key)) continue;
      merged[key] = normalizeAttr(value);
    }
  }
  const out = {};
  for (const id of FEATURE_IDS) {
    out[id] = normalizeAttr(merged[id]);
  }
  return out;
}

export function mergeFeatures(apartmentFeatures, listingFeatures) {
  const building = normalizeFeatures(apartmentFeatures);
  const unit = listingFeatures && typeof listingFeatures === "object" ? listingFeatures : {};
  const merged = { ...building };
  for (const id of FEATURE_IDS) {
    const unitValue = normalizeAttr(unit[id]);
    if (unitValue !== ATTR.UNKNOWN) merged[id] = unitValue;
  }
  return merged;
}

export function hasPreferences(prefs = {}) {
  const merged = defaultUserPrefs(prefs);
  return (
    merged.maxRent != null ||
    (merged.bedrooms && merged.bedrooms.length > 0) ||
    merged.minBathrooms != null ||
    merged.minSqft != null ||
    merged.maxSqft != null ||
    Boolean(merged.moveInEarliest) ||
    Boolean(merged.moveInLatest) ||
    (merged.requiredFeatures && merged.requiredFeatures.length > 0) ||
    (merged.preferredFeatures && merged.preferredFeatures.length > 0) ||
    (merged.preferredNeighborhoods && merged.preferredNeighborhoods.length > 0)
  );
}

export function matchListing(listing, prefs = {}) {
  const merged = defaultUserPrefs(prefs);
  if (!hasPreferences(merged)) {
    return emptyMatch();
  }

  const features = mergeFeatures(listing?.apartmentFeatures, listing?.features);
  const criteria = collectCriteria(listing, merged, features);
  const hardItems = criteria.filter((item) => item.hard);
  const preferredItems = criteria.filter((item) => !item.hard);
  const hardPool = preferredItems.length ? 70 : 100;
  const preferredPool = hardItems.length ? 30 : 100;
  const hardShares = splitPoints(hardItems.length ? hardPool : 0, hardItems.length);
  const preferredShares = splitPoints(preferredItems.length ? preferredPool : 0, preferredItems.length);

  let earned = 0;
  let maxPoints = 0;
  let qualifies = true;
  const checks = [];

  hardItems.forEach((item, index) => {
    const share = hardShares[index];
    maxPoints += share;
    if (item.status === "fail") qualifies = false;
    const points = item.status === "pass" ? share : 0;
    earned += qualifies ? points : 0;
    checks.push({ ...item, points: qualifies && item.status === "pass" ? share : 0, maxPoints: share });
  });

  preferredItems.forEach((item, index) => {
    const share = preferredShares[index];
    maxPoints += share;
    const points = item.status === "pass" ? share : 0;
    earned += qualifies ? points : 0;
    checks.push({ ...item, points: qualifies ? points : 0, maxPoints: share });
  });

  if (!qualifies) {
    return {
      configured: true,
      qualifies: false,
      score: 0,
      headline: "DOES NOT QUALIFY",
      earnedPoints: 0,
      maxPoints,
      checks: checks.map((item) => ({ ...item, points: 0 })),
      unknowns: checks.filter((item) => item.status === "unknown").map((item) => item.id),
    };
  }

  const score = maxPoints === 0 ? 100 : Math.round((earned / maxPoints) * 100);
  return {
    configured: true,
    qualifies: true,
    score,
    headline: `${score}% MATCH`,
    earnedPoints: earned,
    maxPoints,
    checks,
    unknowns: checks.filter((item) => item.status === "unknown").map((item) => item.id),
  };
}

export function cleanSearchName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed || /^Search \d+$/i.test(trimmed)) return "";
  return trimmed;
}

export function hasCustomSearchName(prefs = {}) {
  return Boolean(cleanSearchName(prefs.name));
}

export function suggestSearchName(prefs = {}) {
  const parts = [];
  const bedrooms = prefs.bedrooms || [];
  if (bedrooms.length === 1) {
    const bed = bedrooms[0];
    if (bed === 0) parts.push("Studio");
    else if (bed >= 3) parts.push("3+ bed");
    else parts.push(`${bed} bed`);
  } else if (bedrooms.length > 1) {
    parts.push("Multi-bed");
  }
  if (prefs.maxRent != null && prefs.maxRent !== "") {
    parts.push(`under $${Number(prefs.maxRent).toLocaleString("en-US")}`);
  }
  const hoods = prefs.preferredNeighborhoods || [];
  if (hoods.length) parts.push(hoods.slice(0, 2).join(", "));
  return parts.join(" · ").slice(0, 80);
}

export function displaySearchLabel(prefs = {}, index = 0) {
  const name = cleanSearchName(prefs.name);
  if (name) return { text: name, isPlaceholder: false };
  const suggested = suggestSearchName(prefs);
  if (suggested) return { text: suggested, isPlaceholder: true };
  return { text: index === 0 ? "My search" : "New search", isPlaceholder: true };
}

export function emptyPreferenceBundle() {
  return { matchAlerts: false, profiles: [defaultUserPrefs({ name: "" })] };
}

export function normalizePreferenceBundle(data) {
  if (!data) return emptyPreferenceBundle();
  if (Array.isArray(data.profiles)) {
    const profiles = data.profiles.length ? data.profiles : [{}];
    return {
      matchAlerts: data.matchAlerts === true,
      profiles: profiles.map((profile) => {
        const normalized = defaultUserPrefs(profile);
        return { ...normalized, name: cleanSearchName(normalized.name) };
      }),
    };
  }
  return {
    matchAlerts: data.matchAlerts === true,
    profiles: [defaultUserPrefs({ ...data, name: cleanSearchName(data.name) })],
  };
}

export function matchListingAgainstProfiles(listing, profiles = []) {
  const configured = (Array.isArray(profiles) ? profiles : []).map(defaultUserPrefs).filter(hasPreferences);
  if (!configured.length) return emptyMatch();

  const scored = configured.map((prefs) => {
    const match = matchListing(listing, prefs);
    return {
      ...match,
      profileId: prefs.id || null,
      profileName: prefs.name || "Search",
    };
  });

  const qualifying = scored
    .filter((item) => item.qualifies)
    .sort(
      (left, right) => right.score - left.score || String(left.profileName).localeCompare(String(right.profileName)),
    );
  const winner = qualifying[0] || scored[0];
  const named = configured.length > 1 && winner.profileName;
  const headline = winner.qualifies
    ? named
      ? `${winner.score}% MATCH · ${winner.profileName}`
      : winner.headline
    : "DOES NOT QUALIFY";

  return {
    ...winner,
    headline,
    profiles: scored.map((item) => ({
      id: item.profileId,
      name: item.profileName,
      qualifies: item.qualifies,
      score: item.score,
      headline: item.headline,
    })),
  };
}

export function matchSummaryLines(match) {
  return (match?.checks || []).map((check) => ({
    id: check.id,
    icon: check.status === "pass" ? "✓" : check.status === "fail" ? "❌" : "⚠",
    text: check.summary,
    status: check.status,
    hard: check.hard,
  }));
}

function emptyMatch() {
  return {
    configured: false,
    qualifies: true,
    score: null,
    headline: null,
    earnedPoints: 0,
    maxPoints: 0,
    checks: [],
    unknowns: [],
  };
}

function collectCriteria(listing, prefs, features) {
  const items = [];
  const hard = prefs.hard || DEFAULT_USER_PREFS.hard;

  if (prefs.maxRent != null) {
    items.push(evaluateBudget(listing?.price, Number(prefs.maxRent), hard.maxRent !== false));
  }
  if (prefs.bedrooms?.length) {
    items.push(evaluateBedrooms(listing?.bedrooms, prefs.bedrooms, hard.bedrooms !== false));
  }
  if (prefs.minBathrooms != null) {
    items.push(evaluateBathrooms(listing?.bathrooms, Number(prefs.minBathrooms), hard.bathrooms !== false));
  }
  if (prefs.minSqft != null || prefs.maxSqft != null) {
    items.push(
      evaluateSize(listing?.sqft, prefs.minSqft, prefs.maxSqft, {
        hardMin: prefs.minSqft != null && hard.minSqft !== false,
        hardMax: prefs.maxSqft != null && hard.maxSqft === true,
      }),
    );
  }
  if (prefs.moveInEarliest || prefs.moveInLatest) {
    items.push(evaluateMoveIn(listing?.availableDate || listing?.available_date, prefs, hard.moveIn !== false));
  }
  for (const id of prefs.requiredFeatures || []) {
    items.push(evaluateFeature(id, features[id], true, hard.requiredFeatures !== false));
  }
  for (const id of prefs.preferredFeatures || []) {
    if ((prefs.requiredFeatures || []).includes(id)) continue;
    items.push(evaluateFeature(id, features[id], false, false));
  }
  if (prefs.preferredNeighborhoods?.length) {
    items.push(
      evaluateNeighborhood(
        listing?.location || listing?.apartmentLocation,
        prefs.preferredNeighborhoods,
        hard.neighborhoods === true,
      ),
    );
  }
  return items;
}

function evaluateBudget(price, maxRent, isHard) {
  const base = { id: "maxRent", label: "Rent", hard: isHard };
  if (price == null || price === "") {
    return {
      ...base,
      status: isHard ? "fail" : "unknown",
      summary: isHard ? "Price unknown — cannot pass budget" : "Price unknown",
      detail: "No rent listed, so budget cannot be verified.",
    };
  }
  const amount = Number(price);
  if (amount <= maxRent) {
    return {
      ...base,
      status: "pass",
      summary: "Under budget",
      detail: `$${amount.toLocaleString("en-US")} is at or under $${maxRent.toLocaleString("en-US")}.`,
    };
  }
  return {
    ...base,
    status: isHard ? "fail" : "fail",
    summary: isHard ? "Over budget" : "Above preferred budget",
    detail: `$${amount.toLocaleString("en-US")} is over $${maxRent.toLocaleString("en-US")}.`,
  };
}

function evaluateBedrooms(value, allowed, isHard) {
  const base = { id: "bedrooms", label: "Bedrooms", hard: isHard };
  if (value == null || value === "") {
    return {
      ...base,
      status: "unknown",
      summary: "Bedrooms unknown",
      detail: "Bedroom count was not listed.",
    };
  }
  if (bedroomsAllowed(Number(value), allowed)) {
    return {
      ...base,
      status: "pass",
      summary: "Bedroom requirement",
      detail: `${formatBeds(value)} is in your allowed set.`,
    };
  }
  return {
    ...base,
    status: isHard ? "fail" : "fail",
    summary: "Bedroom requirement",
    detail: `${formatBeds(value)} is not in your allowed set.`,
  };
}

function evaluateBathrooms(value, minBaths, isHard) {
  const base = { id: "bathrooms", label: "Bathrooms", hard: isHard };
  if (value == null || value === "") {
    return {
      ...base,
      status: "unknown",
      summary: "Bathrooms unknown",
      detail: "Bathroom count was not listed.",
    };
  }
  if (Number(value) + 1e-9 >= minBaths) {
    return {
      ...base,
      status: "pass",
      summary: "Bathroom requirement",
      detail: `${value} bath meets the ${minBaths} minimum.`,
    };
  }
  return {
    ...base,
    status: isHard ? "fail" : "fail",
    summary: "Bathroom requirement",
    detail: `${value} bath is below the ${minBaths} minimum.`,
  };
}

function evaluateSize(sqft, minSqft, maxSqft, { hardMin, hardMax }) {
  const isHard = Boolean(hardMin || hardMax);
  const base = { id: "sqft", label: "Sqft", hard: isHard };
  if (sqft == null || sqft === "") {
    return {
      ...base,
      status: "unknown",
      summary: "Size unknown",
      detail: "Square footage was not listed.",
    };
  }
  const size = Number(sqft);
  if (minSqft != null && size < Number(minSqft)) {
    return {
      ...base,
      status: hardMin ? "fail" : "fail",
      summary: "Size requirement",
      detail: `${size.toLocaleString("en-US")} sqft is below ${Number(minSqft).toLocaleString("en-US")} sqft.`,
    };
  }
  if (maxSqft != null && size > Number(maxSqft)) {
    return {
      ...base,
      status: hardMax ? "fail" : "fail",
      summary: "Size requirement",
      detail: `${size.toLocaleString("en-US")} sqft is above ${Number(maxSqft).toLocaleString("en-US")} sqft.`,
    };
  }
  return {
    ...base,
    status: "pass",
    summary: "Size requirement",
    detail: `${size.toLocaleString("en-US")} sqft is within your size range.`,
  };
}

function evaluateMoveIn(availableDate, prefs, isHard) {
  const base = { id: "moveIn", label: "Move-in", hard: isHard };
  if (availableDate == null || availableDate === "") {
    return {
      ...base,
      status: "unknown",
      summary: "Move-in date unknown",
      detail: "Availability date was not listed.",
    };
  }
  const listingDate = parseAvailableDate(availableDate);
  if (!listingDate) {
    return {
      ...base,
      status: "unknown",
      summary: "Move-in date unknown",
      detail: `Could not parse availability (${availableDate}).`,
    };
  }
  const earliest = prefs.moveInEarliest ? Date.parse(prefs.moveInEarliest) : null;
  const latest = prefs.moveInLatest ? Date.parse(prefs.moveInLatest) : null;
  const time = listingDate.getTime();
  if (earliest != null && !Number.isNaN(earliest) && time < startOfDay(earliest)) {
    return {
      ...base,
      status: isHard ? "fail" : "fail",
      summary: "Move-in date",
      detail: "Available earlier than your earliest move-in date.",
    };
  }
  if (latest != null && !Number.isNaN(latest) && time > endOfDay(latest)) {
    return {
      ...base,
      status: isHard ? "fail" : "fail",
      summary: "Move-in date",
      detail: "Available later than your latest move-in date.",
    };
  }
  return {
    ...base,
    status: "pass",
    summary: "Move-in date works",
    detail: "Availability falls inside your move-in window.",
  };
}

function evaluateFeature(id, value, required, isHard) {
  const label = featureLabel(id);
  const base = { id: `feature:${id}`, label, hard: required && isHard };
  if (value === ATTR.YES) {
    return {
      ...base,
      status: "pass",
      summary: label,
      detail: `${label} is listed as yes.`,
    };
  }
  if (value === ATTR.NO) {
    return {
      ...base,
      status: base.hard ? "fail" : "fail",
      summary: label,
      detail: `${label} is listed as no.`,
    };
  }
  return {
    ...base,
    status: "unknown",
    summary: `${shortFeature(id)} unknown`,
    detail: `${label} could not be determined (UNKNOWN, not no).`,
  };
}

function evaluateNeighborhood(location, preferred, isHard) {
  const base = { id: "neighborhood", label: "Location", hard: isHard };
  if (!location) {
    return {
      ...base,
      status: "unknown",
      summary: "Neighborhood unknown",
      detail: "No neighborhood/area is stored for this building.",
    };
  }
  const haystack = String(location).toLowerCase();
  const hit = preferred.find((name) => haystack.includes(String(name).trim().toLowerCase()));
  if (hit) {
    return {
      ...base,
      status: "pass",
      summary: "Preferred area",
      detail: `${location} matches “${hit}”.`,
    };
  }
  return {
    ...base,
    status: isHard ? "fail" : "fail",
    summary: "Preferred area",
    detail: `${location} is outside your preferred areas.`,
  };
}

function bedroomsAllowed(beds, allowed) {
  const nums = allowed.map(Number);
  if (nums.includes(beds)) return true;
  if (nums.includes(3) && beds >= 3) return true;
  return false;
}

function formatBeds(value) {
  if (Number(value) === 0) return "Studio";
  return `${value} bed`;
}

function shortFeature(id) {
  if (id === "laundry") return "Laundry";
  if (id === "airConditioning") return "A/C";
  return featureLabel(id);
}

export function splitPoints(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function parseAvailableDate(value) {
  if (value === "now") {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function startOfDay(ms) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(ms) {
  return startOfDay(ms) + 24 * 60 * 60 * 1000 - 1;
}
