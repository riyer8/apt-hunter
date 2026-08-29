/**
 * Building profile prompts — edit these directly.
 * Analysis uses gathered web sources (official site, Yelp, Google review snippets).
 */

export const BUILDING_PROFILE_SYSTEM_PROMPT = `You help renters compare apartment BUILDINGS (not individual units).

You will receive SOURCES fetched from the web: official property pages, Yelp reviews, and Google review snippets.
Base every score and fact on those sources. Quote review themes and management complaints/praise in your evidence fields.
Do not invent construction years, amenities, or review quotes that are not supported by the sources.
If a category has no source material, set insufficient=true and score=null.
Never claim a specific unit has a view — only building-level patterns.

Score each category 0–10:
- safety: neighborhood safety + building security (concierge, controlled access, etc.)
- walkability: walk/transit access, daily errands, social life for someone in their 20s
- viewsSun: typical building-level light, outdoor space, rooftop/deck, bay/city outlook
- amenities: quality and breadth of building perks (gym, pool, lounge, parking, etc.) as described in marketing AND reviews
- management: responsiveness, maintenance quality, leasing office, move-in/out experience — heavily weight Yelp/Google resident reviews

Building age:
- Prefer an explicit construction year (yearBuilt) when sources mention "built in", "completed", "opened", "year built", etc.
- Also score buildingAge (0–10, newer/modern = higher) from source cues like "new construction", "historic", "mid-century", "recently renovated" when no exact year is available.
- When you provide yearBuilt, include the exact supporting quote in yearBuiltEvidence.

Differentiate buildings clearly. Two buildings in the same neighborhood should not get identical scores unless the sources support that.

Return valid JSON only.`;

export const BUILDING_PROFILE_JSON_SCHEMA = `{
  "facts": {
    "yearBuilt": number or null,
    "yearBuiltEvidence": "short quote from sources or null",
    "walkScore": number or null,
    "stories": number or null,
    "neighborhood": "string or null",
    "managementCompany": "property manager / operator name or null",
    "reviewSummary": "2-3 sentences on resident review themes (maintenance, noise, staff, pests, value)",
    "amenities": ["gym","pool","rooftop","lounge","coworking","parking","packageRoom","concierge","laundry","outdoor","elevator","airConditioning"]
  },
  "judgments": {
    "safety": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote or review theme" },
    "buildingAge": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote about age, era, or construction" },
    "walkability": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote or review theme" },
    "viewsSun": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote or review theme" },
    "amenities": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote or review theme" },
    "management": { "score": 0-10 or null, "insufficient": boolean, "rationale": "...", "evidence": "quote or review theme from Yelp/Google" }
  },
  "summary": "2-4 sentences for a renter deciding whether to tour — mention management/review highlights."
}`;

export function buildBuildingProfileUserPrompt(apartment, sources = []) {
  const name = apartment.name || "Unknown building";
  const url = apartment.source_url || apartment.url || "";
  const location = apartment.location || inferNeighborhood(name) || "unknown";
  const sourceBlock = (sources || [])
    .map((item) => `### ${item.title || "Source"} (${item.url || "n/a"})\n${item.text || ""}`)
    .join("\n\n")
    .slice(0, 28000);

  return `Research this apartment building and return scores.

Building name: ${name}
Official URL: ${url || "none"}
Location / neighborhood: ${location}

Audience: young professional comparing SF Bay Area buildings.
Prioritize walkability, safety, management quality, review sentiment, and real amenity value.

Read the sources below carefully — especially Yelp and Google review text for management, maintenance, and resident experience.

SOURCES:
${sourceBlock || "(no sources were fetched — mark categories insufficient)"}

${BUILDING_PROFILE_JSON_SCHEMA}`;
}

export function inferNeighborhood(name) {
  const match = String(name || "").match(
    /\b(Dogpatch|SoMa|Mission|Marina|Pac Heights|Pacific Heights|Hayes Valley|Nob Hill|Richmond|Sunset|FiDi|Financial District)\b/i,
  );
  return match ? `${match[1]}, San Francisco` : null;
}
