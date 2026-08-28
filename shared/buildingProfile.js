/**
 * Building-level scores and overall average.
 * Facts (year built, amenity list) stay separate from AI judgments.
 */

export const BUILDING_SCORE_WEIGHTS = {
  safety: 0.25,
  buildingAge: 0.15,
  walkability: 0.25,
  viewsSun: 0.15,
  amenities: 0.2,
};

export const BUILDING_SCORE_KEYS = [
  { id: "safety", label: "Safety", short: "Safety", weight: 0.25 },
  { id: "buildingAge", label: "Building Age", short: "Age", weight: 0.15 },
  { id: "walkability", label: "Walkability / New-grad Life", short: "Walkability", weight: 0.25 },
  { id: "viewsSun", label: "Views / Sun", short: "Views/Sun", weight: 0.15 },
  { id: "amenities", label: "Amenities", short: "Amenities", weight: 0.2 },
];

export const BUILDING_AMENITIES = [
  { id: "gym", label: "Gym" },
  { id: "pool", label: "Pool" },
  { id: "rooftop", label: "Rooftop" },
  { id: "lounge", label: "Lounge" },
  { id: "coworking", label: "Coworking" },
  { id: "parking", label: "Parking" },
  { id: "packageRoom", label: "Package room" },
  { id: "concierge", label: "Concierge" },
  { id: "laundry", label: "Laundry" },
  { id: "outdoor", label: "Outdoor space" },
  { id: "elevator", label: "Elevator" },
  { id: "airConditioning", label: "Air conditioning" },
];

export const ANALYSIS_VERSION = 1;

export function round1(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 10) / 10;
}

export function buildingAgeYears(yearBuilt, nowYear = new Date().getFullYear()) {
  const year = Number(yearBuilt);
  if (!Number.isInteger(year) || year < 1800 || year > nowYear + 1) return null;
  return Math.max(0, nowYear - year);
}

/** Newer buildings score higher: 10 at age 0, minus 0.12 per year, floored at 0. */
export function buildingAgeScoreFromYear(yearBuilt, nowYear = new Date().getFullYear()) {
  const age = buildingAgeYears(yearBuilt, nowYear);
  if (age == null) return null;
  return round1(Math.max(0, Math.min(10, 10 - age * 0.12)));
}

export function overallBuildingScore(scores = {}) {
  let weighted = 0;
  let used = 0;
  const missing = [];
  for (const item of BUILDING_SCORE_KEYS) {
    const value = scores[item.id];
    if (value == null || value === "" || Number.isNaN(Number(value))) {
      missing.push(item.id);
      continue;
    }
    weighted += Number(value) * item.weight;
    used += item.weight;
  }
  if (used === 0) {
    return { score: null, missing, usedWeight: 0, incomplete: true };
  }
  return {
    score: round1(weighted / used),
    missing,
    usedWeight: used,
    incomplete: missing.length > 0,
  };
}

export function scoreBand(score) {
  if (score == null || Number.isNaN(Number(score))) return "unknown";
  const value = Number(score);
  if (value >= 8) return "excellent";
  if (value >= 6) return "good";
  if (value >= 4) return "mixed";
  return "poor";
}

export function scoreEmoji(score) {
  const band = scoreBand(score);
  if (band === "excellent") return "🟢";
  if (band === "good") return "🟡";
  if (band === "mixed") return "🟠";
  if (band === "poor") return "🔴";
  return "⚪";
}

export function formatBuildingScore(score) {
  if (score == null || score === "" || Number.isNaN(Number(score))) return "UNKNOWN";
  return round1(Number(score)).toFixed(1);
}

export function isTerminalBuildingStatus(status) {
  return Boolean(status) && !["pending", "running"].includes(status);
}

export function amenityLabel(id) {
  return BUILDING_AMENITIES.find((item) => item.id === id)?.label || id;
}

export function emptyBuildingProfile() {
  return {
    yearBuilt: null,
    buildingAge: null,
    yearBuiltSource: null,
    safetyScore: null,
    buildingAgeScore: null,
    walkabilityScore: null,
    viewsSunScore: null,
    amenitiesScore: null,
    overallScore: null,
    overallIncomplete: false,
    missingCategories: BUILDING_SCORE_KEYS.map((item) => item.id),
    amenities: [],
    facts: {},
    judgments: {},
    summary: null,
    evidence: [],
    status: "pending",
    analyzedAt: null,
    analysisVersion: 0,
    model: null,
  };
}

export function yearMentionedInSources(year, sourcesText) {
  if (year == null) return false;
  return String(sourcesText || "").includes(String(year));
}

export function clampScore(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return null;
  const number = Number(value);
  if (number < 0 || number > 10) return null;
  return round1(number);
}

/**
 * Merge model output with derived age score.
 * Year built is kept only when it appears in the gathered source text.
 */
export function finalizeBuildingProfile({ raw, sourcesText, nowYear = new Date().getFullYear(), model = null }) {
  const facts = raw?.facts && typeof raw.facts === "object" ? raw.facts : {};
  const judgments = raw?.judgments && typeof raw.judgments === "object" ? raw.judgments : {};
  const claimedYear = facts.yearBuilt == null || facts.yearBuilt === "" ? null : Number(facts.yearBuilt);
  const yearBuilt =
    Number.isInteger(claimedYear) && yearMentionedInSources(claimedYear, sourcesText) ? claimedYear : null;
  const buildingAge = buildingAgeYears(yearBuilt, nowYear);
  const buildingAgeScore = buildingAgeScoreFromYear(yearBuilt, nowYear);

  const safety = judgmentScore(judgments.safety);
  const walkability = judgmentScore(judgments.walkability);
  const viewsSun = judgmentScore(judgments.viewsSun);
  const amenitiesScore = judgmentScore(judgments.amenities);
  const overall = overallBuildingScore({
    safety,
    buildingAge: buildingAgeScore,
    walkability,
    viewsSun,
    amenities: amenitiesScore,
  });

  const amenities = normalizeAmenityList(facts.amenities);
  const evidence = collectEvidence({ yearBuilt, facts, judgments, sourcesText });

  const anyScore = [safety, buildingAgeScore, walkability, viewsSun, amenitiesScore].some((value) => value != null);
  const status = anyScore ? "complete" : "insufficient";

  return {
    yearBuilt,
    buildingAge,
    yearBuiltSource: yearBuilt ? facts.yearBuiltEvidence || facts.yearBuiltSource || null : null,
    safetyScore: safety,
    buildingAgeScore,
    walkabilityScore: walkability,
    viewsSunScore: viewsSun,
    amenitiesScore,
    overallScore: overall.score,
    overallIncomplete: overall.incomplete,
    missingCategories: overall.missing,
    amenities,
    facts: {
      yearBuilt,
      buildingAge,
      walkScore: facts.walkScore ?? null,
      stories: facts.stories ?? null,
      neighborhood: facts.neighborhood || null,
      amenities,
    },
    judgments: {
      safety: judgmentRecord(judgments.safety, safety),
      buildingAge: {
        score: buildingAgeScore,
        rationale: yearBuilt
          ? `Derived from year built ${yearBuilt} (age ${buildingAge}): 10 − age × 0.12.`
          : "Insufficient evidence — no verified construction year in sources.",
        insufficient: buildingAgeScore == null,
      },
      walkability: judgmentRecord(judgments.walkability, walkability),
      viewsSun: judgmentRecord(judgments.viewsSun, viewsSun),
      amenities: judgmentRecord(judgments.amenities, amenitiesScore),
    },
    summary: status === "insufficient" ? raw?.summary || "Insufficient evidence" : raw?.summary || null,
    evidence,
    status,
    analysisVersion: ANALYSIS_VERSION,
    model,
  };
}

function judgmentScore(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.insufficient === true) return null;
  return clampScore(entry.score);
}

function judgmentRecord(entry, score) {
  if (score == null) {
    return {
      score: null,
      rationale: entry?.rationale || "Insufficient evidence",
      insufficient: true,
    };
  }
  return {
    score,
    rationale: entry?.rationale || null,
    insufficient: false,
  };
}

function normalizeAmenityList(list) {
  const allowed = new Set(BUILDING_AMENITIES.map((item) => item.id));
  return (Array.isArray(list) ? list : []).map(String).filter((id) => allowed.has(id));
}

function collectEvidence({ yearBuilt, facts, judgments, sourcesText }) {
  const items = [];
  if (yearBuilt) {
    items.push({
      category: "buildingAge",
      fact: `Year built ${yearBuilt}`,
      quote: facts.yearBuiltEvidence || null,
    });
  }
  for (const key of ["safety", "walkability", "viewsSun", "amenities"]) {
    const entry = judgments[key];
    if (entry?.evidence) {
      items.push({ category: key, quote: String(entry.evidence).slice(0, 500) });
    }
  }
  if (!items.length && sourcesText) {
    items.push({ category: "sources", quote: "See gathered building pages." });
  }
  return items;
}
