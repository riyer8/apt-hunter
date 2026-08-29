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

export function isPlausibleConstructionYear(year, nowYear = new Date().getFullYear()) {
  const value = Number(year);
  return Number.isInteger(value) && value >= 1850 && value <= nowYear + 2;
}

const CONSTRUCTION_YEAR_PATTERNS = [
  { re: /\byear\s+built[:\s]+((?:19|20)\d{2})\b/gi, weight: 12, group: 1 },
  { re: /\b(?:newly\s+)?built\s+in\s+((?:19|20)\d{2})\b/gi, weight: 11, group: 1 },
  { re: /\bcompleted\s+in\s+((?:19|20)\d{2})\b/gi, weight: 10, group: 1 },
  { re: /\bopened\s+in\s+((?:19|20)\d{2})\b/gi, weight: 10, group: 1 },
  { re: /\bconstructed\s+in\s+((?:19|20)\d{2})\b/gi, weight: 10, group: 1 },
  { re: /\bestablished\s+in\s+((?:19|20)\d{2})\b/gi, weight: 9, group: 1 },
  { re: /\boriginally\s+(?:built|opened)\s+(?:in\s+)?((?:19|20)\d{2})\b/gi, weight: 10, group: 1 },
  { re: /\bdelivered\s+in\s+((?:19|20)\d{2})\b/gi, weight: 9, group: 1 },
  {
    re: /\b((?:19|20)\d{2})\s+(?:apartment|residential)\s+(?:tower|building|high[\s-]?rise|community)\b/gi,
    weight: 8,
    group: 1,
  },
  { re: /\brenovated\s+(?:in\s+)?((?:19|20)\d{2})\b/gi, weight: 2, group: 1, renovation: true },
];

/**
 * Pull a construction year from scraped page text using contextual phrases.
 * Prefers "built in" / "year built" over bare years or renovation dates.
 */
export function extractConstructionYearFromSources(sourcesText, nowYear = new Date().getFullYear()) {
  const text = String(sourcesText || "");
  const candidates = [];

  for (const pattern of CONSTRUCTION_YEAR_PATTERNS) {
    for (const match of text.matchAll(pattern.re)) {
      const year = Number(match[pattern.group]);
      if (!isPlausibleConstructionYear(year, nowYear)) continue;
      const start = Math.max(0, match.index - 24);
      const end = Math.min(text.length, match.index + match[0].length + 48);
      candidates.push({
        year,
        weight: pattern.weight,
        renovation: Boolean(pattern.renovation),
        quote: text.slice(start, end).trim(),
      });
    }
  }

  if (!candidates.length) return null;

  const construction = candidates.filter((item) => !item.renovation);
  const pool = construction.length ? construction : candidates;
  pool.sort((left, right) => right.weight - left.weight || right.year - left.year);
  const best = pool[0];
  return { year: best.year, quote: best.quote };
}

function resolveYearBuilt({ facts, sourcesText, trustModelFacts, nowYear }) {
  const claimedYear = facts.yearBuilt == null || facts.yearBuilt === "" ? null : Number(facts.yearBuilt);
  const evidenceText = [facts.yearBuiltEvidence, facts.yearBuiltSource].filter(Boolean).join(" ");
  const combinedText = `${sourcesText || ""}\n${evidenceText}`;
  const extracted = extractConstructionYearFromSources(combinedText, nowYear);

  if (
    trustModelFacts &&
    Number.isInteger(claimedYear) &&
    isPlausibleConstructionYear(claimedYear, nowYear)
  ) {
    return {
      year: claimedYear,
      source: facts.yearBuiltEvidence || facts.yearBuiltSource || "Model estimate",
    };
  }

  if (extracted?.year) {
    if (Number.isInteger(claimedYear) && claimedYear === extracted.year) {
      return { year: claimedYear, source: facts.yearBuiltEvidence || extracted.quote };
    }
    if (
      Number.isInteger(claimedYear) &&
      isPlausibleConstructionYear(claimedYear, nowYear) &&
      yearMentionedInSources(claimedYear, combinedText)
    ) {
      return { year: claimedYear, source: facts.yearBuiltEvidence || facts.yearBuiltSource };
    }
    return { year: extracted.year, source: extracted.quote };
  }

  if (
    Number.isInteger(claimedYear) &&
    isPlausibleConstructionYear(claimedYear, nowYear) &&
    yearMentionedInSources(claimedYear, combinedText)
  ) {
    return { year: claimedYear, source: facts.yearBuiltEvidence || facts.yearBuiltSource };
  }

  return { year: null, source: null };
}

export function clampScore(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return null;
  const number = Number(value);
  if (number < 0 || number > 10) return null;
  return round1(number);
}

/**
 * Merge model output with derived age score.
 * Year built is resolved from source text patterns first, then verified model claims.
 * When no year is found, falls back to the model's buildingAge judgment score.
 */
export function finalizeBuildingProfile({
  raw,
  sourcesText,
  nowYear = new Date().getFullYear(),
  model = null,
  trustModelFacts = false,
}) {
  const facts = raw?.facts && typeof raw.facts === "object" ? raw.facts : {};
  const judgments = raw?.judgments && typeof raw.judgments === "object" ? raw.judgments : {};
  const resolvedYear = resolveYearBuilt({ facts, sourcesText, trustModelFacts, nowYear });
  const yearBuilt = resolvedYear.year;
  const buildingAge = buildingAgeYears(yearBuilt, nowYear);
  const derivedAgeScore = buildingAgeScoreFromYear(yearBuilt, nowYear);
  const estimatedAgeScore = judgmentScore(judgments.buildingAge);
  const buildingAgeScore = derivedAgeScore ?? estimatedAgeScore;
  const amenities = normalizeAmenityList(facts.amenities);

  const safety = judgmentScore(judgments.safety);
  const walkability = judgmentScore(judgments.walkability);
  const viewsSun = judgmentScore(judgments.viewsSun);
  const amenitiesScore = judgmentScore(judgments.amenities) ?? amenitiesScoreFromList(amenities);
  const overall = overallBuildingScore({
    safety,
    buildingAge: buildingAgeScore,
    walkability,
    viewsSun,
    amenities: amenitiesScore,
  });

  const evidence = collectEvidence({
    yearBuilt,
    yearBuiltSource: resolvedYear.source,
    facts,
    judgments,
    sourcesText,
  });

  const anyScore = [safety, buildingAgeScore, walkability, viewsSun, amenitiesScore].some((value) => value != null);
  const status = anyScore ? "complete" : "insufficient";

  return {
    yearBuilt,
    buildingAge,
    yearBuiltSource: yearBuilt ? resolvedYear.source || facts.yearBuiltEvidence || facts.yearBuiltSource || null : null,
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
      managementCompany: facts.managementCompany || null,
      reviewSummary: facts.reviewSummary || null,
      amenities,
    },
    judgments: {
      safety: judgmentRecord(judgments.safety, safety),
      buildingAge: yearBuilt
        ? {
            score: buildingAgeScore,
            rationale: `Derived from year built ${yearBuilt} (age ${buildingAge}): 10 − age × 0.12.`,
            insufficient: buildingAgeScore == null,
          }
        : derivedAgeScore == null && estimatedAgeScore != null
          ? judgmentRecord(judgments.buildingAge, estimatedAgeScore)
          : {
              score: buildingAgeScore,
              rationale:
                buildingAgeScore == null
                  ? judgments.buildingAge?.rationale ||
                    "Insufficient evidence — no construction year or age estimate in sources."
                  : judgments.buildingAge?.rationale || null,
              insufficient: buildingAgeScore == null,
            },
      walkability: judgmentRecord(judgments.walkability, walkability),
      viewsSun: judgmentRecord(judgments.viewsSun, viewsSun),
      amenities: judgmentRecord(judgments.amenities, amenitiesScore),
      management: judgmentRecord(judgments.management, judgmentScore(judgments.management)),
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

/** Fallback when the model lists amenities but does not score them. */
export function amenitiesScoreFromList(amenities) {
  const count = (amenities || []).length;
  if (count === 0) return null;
  return round1(Math.min(10, 3.5 + count * 0.75));
}

function collectEvidence({ yearBuilt, yearBuiltSource, facts, judgments, sourcesText }) {
  const items = [];
  if (yearBuilt) {
    items.push({
      category: "buildingAge",
      fact: `Year built ${yearBuilt}`,
      quote: yearBuiltSource || facts.yearBuiltEvidence || null,
    });
  } else if (judgments.buildingAge?.evidence || judgments.buildingAge?.rationale) {
    items.push({
      category: "buildingAge",
      fact: "Estimated building age",
      quote: judgments.buildingAge.evidence || judgments.buildingAge.rationale,
    });
  }
  for (const key of ["safety", "walkability", "viewsSun", "amenities", "management"]) {
    const entry = judgments[key];
    if (entry?.evidence) {
      items.push({ category: key, quote: String(entry.evidence).slice(0, 500) });
    }
  }
  if (!items.length && sourcesText) {
    items.push({ category: "sources", quote: "See gathered web sources." });
  }
  return items;
}
