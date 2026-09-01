import { isPlausibleConstructionYear } from "../../shared/buildingProfile.js";
import { inferNeighborhood } from "./buildingProfilePrompt.js";

export const YEAR_BUILT_SYSTEM_PROMPT = `You identify the original construction year of apartment buildings (not renovation dates).

Return JSON only:
{
  "yearBuilt": number or null,
  "confidence": "high" | "medium" | "low",
  "source": "one sentence on how you know (permit records, developer announcement, property database, etc.)"
}

Rules:
- yearBuilt is when the building first opened for residents, not a renovation.
- Use null when you are unsure or the name is ambiguous.
- confidence "high" only when you are confident about this specific building.
- Do not guess from neighborhood averages.`;

export function buildYearBuiltUserPrompt(apartment) {
  const name = apartment.name || "Unknown building";
  const location = apartment.location || inferNeighborhood(name) || "San Francisco, CA";
  const url = apartment.source_url || apartment.url || "";
  return `What year was this apartment building originally built?

Building: ${name}
Location: ${location}
Official URL: ${url || "none"}`;
}

export function parseYearBuiltLookup(raw, nowYear = new Date().getFullYear()) {
  if (!raw || typeof raw !== "object") return null;
  const year = raw.yearBuilt == null || raw.yearBuilt === "" ? null : Number(raw.yearBuilt);
  if (!isPlausibleConstructionYear(year, nowYear)) return null;
  const confidence = String(raw.confidence || "").toLowerCase();
  if (confidence !== "high" && confidence !== "medium") return null;
  const source = String(raw.source || "").trim();
  if (!source) return null;
  return { yearBuilt: year, source: `OpenAI (${confidence}): ${source}` };
}

export async function lookupYearBuiltWithOpenAI(apartment, { apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey) return null;

  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: YEAR_BUILT_SYSTEM_PROMPT },
        { role: "user", content: buildYearBuiltUserPrompt(apartment) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Year-built lookup failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  let raw = {};
  try {
    raw = JSON.parse(text);
  } catch {
    raw = {};
  }
  return parseYearBuiltLookup(raw);
}
