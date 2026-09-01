import { isTerminalBuildingStatus } from "../../shared/buildingProfile.js";
import { query } from "./db.js";
import { createBuildingIntelligence } from "./buildingIntelligence.js";
import { gatherBuildingResearch } from "./buildingResearch.js";
import {
  BUILDING_PROFILE_SYSTEM_PROMPT,
  buildBuildingProfileUserPrompt,
} from "./buildingProfilePrompt.js";
import { lookupYearBuiltWithOpenAI } from "./buildingYearLookup.js";
import { toApiBuildingProfile } from "./serialize.js";

const inflight = new Set();

export async function loadBuildingProfileRow(apartmentId) {
  const result = await query("SELECT * FROM building_profiles WHERE apartment_id = $1", [apartmentId]);
  return result.rows[0] || null;
}

export async function buildingProfilesFor(apartmentIds) {
  const map = new Map();
  if (!apartmentIds.length) return map;
  const result = await query("SELECT * FROM building_profiles WHERE apartment_id = ANY($1::uuid[])", [apartmentIds]);
  for (const row of result.rows) map.set(row.apartment_id, toApiBuildingProfile(row));
  return map;
}

export async function insertPendingBuildingProfile(apartmentId) {
  await query(
    `INSERT INTO building_profiles (apartment_id, status)
     VALUES ($1, 'pending')
     ON CONFLICT (apartment_id) DO NOTHING`,
    [apartmentId],
  );
}

export async function saveBuildingProfile(apartmentId, profile) {
  await query(
    `INSERT INTO building_profiles (
       apartment_id, year_built, building_age, year_built_source,
       safety_score, building_age_score, walkability_score, views_sun_score, amenities_score,
       overall_score, overall_incomplete, missing_categories, amenities, facts, judgments,
       summary, evidence, status, analyzed_at, analysis_version, model, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
       $16,$17::jsonb,$18,$19,$20,$21, now()
     )
     ON CONFLICT (apartment_id) DO UPDATE SET
       year_built = EXCLUDED.year_built,
       building_age = EXCLUDED.building_age,
       year_built_source = EXCLUDED.year_built_source,
       safety_score = EXCLUDED.safety_score,
       building_age_score = EXCLUDED.building_age_score,
       walkability_score = EXCLUDED.walkability_score,
       views_sun_score = EXCLUDED.views_sun_score,
       amenities_score = EXCLUDED.amenities_score,
       overall_score = EXCLUDED.overall_score,
       overall_incomplete = EXCLUDED.overall_incomplete,
       missing_categories = EXCLUDED.missing_categories,
       amenities = EXCLUDED.amenities,
       facts = EXCLUDED.facts,
       judgments = EXCLUDED.judgments,
       summary = EXCLUDED.summary,
       evidence = EXCLUDED.evidence,
       status = EXCLUDED.status,
       analyzed_at = EXCLUDED.analyzed_at,
       analysis_version = EXCLUDED.analysis_version,
       model = EXCLUDED.model,
       updated_at = now()`,
    [
      apartmentId,
      profile.yearBuilt,
      profile.buildingAge,
      profile.yearBuiltSource,
      profile.safetyScore,
      profile.buildingAgeScore,
      profile.walkabilityScore,
      profile.viewsSunScore,
      profile.amenitiesScore,
      profile.overallScore,
      profile.overallIncomplete === true,
      JSON.stringify(profile.missingCategories || []),
      JSON.stringify(profile.amenities || []),
      JSON.stringify(profile.facts || {}),
      JSON.stringify(profile.judgments || {}),
      profile.summary,
      JSON.stringify(profile.evidence || []),
      profile.status,
      profile.analyzedAt,
      profile.analysisVersion,
      profile.model,
    ],
  );
}

async function saveBuildingProfileHistory(apartmentId, existing) {
  await query(
    `INSERT INTO building_profile_history (apartment_id, analysis_version, snapshot, analyzed_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [
      apartmentId,
      existing.analysisVersion || existing.analysis_version || 0,
      JSON.stringify(existing.snapshot || existing),
      existing.analyzedAt || existing.analyzed_at || new Date().toISOString(),
    ],
  );
}

const intelligence = createBuildingIntelligence({
  loadProfile: async (id) => toApiBuildingProfile(await loadBuildingProfileRow(id)),
  saveProfile: saveBuildingProfile,
  saveHistory: async (id, existing) => saveBuildingProfileHistory(id, existing),
  gather: gatherBuildingResearch,
  complete: completeWithOpenAI,
  lookupYearBuilt: async (apartment) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    return lookupYearBuiltWithOpenAI(apartment, {
      apiKey: key,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  },
});

export function queueBuildingAnalysis(apartment, { force = false } = {}) {
  const id = apartment.id || apartment;
  if (!id) return;
  if (inflight.has(id) && !force) return;
  inflight.add(id);
  const row = typeof apartment === "object" ? apartment : { id };
  Promise.resolve()
    .then(async () => {
      const full = row.name ? row : (await query("SELECT * FROM apartments WHERE id = $1", [id])).rows[0];
      if (!full) return;
      await intelligence.analyze(full, { force });
    })
    .catch((error) => {
      console.error("Building analysis failed:", error.message);
    })
    .finally(() => inflight.delete(id));
}

export async function reanalyzeBuilding(apartment) {
  inflight.delete(apartment.id);
  await intelligence.analyze(apartment, { force: true });
  return toApiBuildingProfile(await loadBuildingProfileRow(apartment.id));
}

export async function reanalyzeAllBuildingProfiles({ dryRun = false, failedOnly = false, onProgress } = {}) {
  const result = failedOnly
    ? await query(
        `SELECT a.*
         FROM apartments a
         INNER JOIN building_profiles p ON p.apartment_id = a.id
         WHERE p.status = 'failed'
         ORDER BY a.name ASC`,
      )
    : await query("SELECT * FROM apartments ORDER BY name ASC");
  const apartments = result.rows;
  const outcomes = [];

  for (let i = 0; i < apartments.length; i++) {
    const apartment = apartments[i];
    const progress = { index: i + 1, total: apartments.length, apartment };
    onProgress?.({ ...progress, status: "start" });

    if (dryRun) {
      outcomes.push({ id: apartment.id, name: apartment.name, ok: true, skipped: true });
      continue;
    }

    try {
      const profile = await reanalyzeBuilding(apartment);
      outcomes.push({ id: apartment.id, name: apartment.name, ok: true, profile });
      onProgress?.({ ...progress, status: "done", profile });
    } catch (error) {
      outcomes.push({ id: apartment.id, name: apartment.name, ok: false, error: error.message });
      onProgress?.({ ...progress, status: "error", error });
    }
  }

  return outcomes;
}

export async function maybeStartBuildingProfileOnFirstScrape(apartment) {
  const id = apartment?.id || apartment;
  if (!id) return;

  const success = await query(
    `SELECT COUNT(*)::int AS count
     FROM scrape_runs
     WHERE apartment_id = $1 AND status = 'success'`,
    [id],
  );
  if (success.rows[0]?.count !== 1) return;

  const existing = await loadBuildingProfileRow(id);
  if (existing && (isTerminalBuildingStatus(existing.status) || existing.status === "running")) return;

  await insertPendingBuildingProfile(id);
  queueBuildingAnalysis(apartment);
}

export async function backfillMissingBuildingProfiles() {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const result = await query(
    `SELECT a.*
     FROM apartments a
     INNER JOIN (
       SELECT DISTINCT apartment_id
       FROM scrape_runs
       WHERE status = 'success'
     ) scraped ON scraped.apartment_id = a.id
     LEFT JOIN building_profiles p ON p.apartment_id = a.id
     WHERE p.apartment_id IS NULL
        OR p.status IN ('pending', 'running')
        OR ($1::boolean AND p.status = 'skipped' AND p.model IS NULL)
        OR ($1::boolean AND p.status = 'failed')`,
    [hasOpenAi],
  );
  for (const row of result.rows) {
    await insertPendingBuildingProfile(row.id);
    queueBuildingAnalysis(row);
  }
}

export async function listBuildingProfileHistory(apartmentId) {
  const result = await query(
    `SELECT analysis_version, analyzed_at, snapshot
     FROM building_profile_history
     WHERE apartment_id = $1
     ORDER BY analysis_version DESC
     LIMIT 10`,
    [apartmentId],
  );
  return result.rows.map((row) => ({
    analysisVersion: Number(row.analysis_version),
    analyzedAt: row.analyzed_at,
    snapshot: row.snapshot,
  }));
}

async function completeWithOpenAI({ apartment, sources }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { skipped: true };

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = buildBuildingProfileUserPrompt(apartment, sources);
  const hasSources = (sources || []).some((item) => String(item.text || "").trim().length > 80);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BUILDING_PROFILE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  let raw = {};
  try {
    raw = JSON.parse(text);
  } catch {
    raw = {};
  }
  return { model, raw, trustModelFacts: !hasSources };
}
