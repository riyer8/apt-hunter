import {
  ANALYSIS_VERSION,
  finalizeBuildingProfile,
  isTerminalBuildingStatus,
} from "../../shared/buildingProfile.js";

export function createBuildingIntelligence({
  loadProfile,
  saveProfile,
  saveHistory,
  gather,
  complete,
  nowYear = () => new Date().getFullYear(),
} = {}) {
  async function analyze(apartment, { force = false } = {}) {
    const existing = await loadProfile(apartment.id);
    if (existing && !force && isTerminalBuildingStatus(existing.status)) {
      return { ran: false, reason: "already-analyzed", profile: existing };
    }

    if (force && existing && isTerminalBuildingStatus(existing.status)) {
      await saveHistory?.(apartment.id, existing);
    }

    await saveProfile(apartment.id, {
      ...(existing || emptyish(existing)),
      status: "running",
    });

    try {
      const sources = await gather(apartment);
      const sourcesText = (sources || []).map((item) => `${item.url || ""}\n${item.text || ""}`).join("\n");
      const completion = await complete({ apartment, sources });

      if (completion?.skipped) {
        const profile = {
          ...emptyish(existing),
          status: "skipped",
          summary: "OpenAI API key not configured. Add OPENAI_API_KEY to server/.env, then Re-analyze Building.",
          analysisVersion: nextVersion(existing, force),
          analyzedAt: new Date().toISOString(),
          model: null,
        };
        await saveProfile(apartment.id, profile);
        return { ran: true, reason: "skipped-no-key", profile };
      }

      const finalized = finalizeBuildingProfile({
        raw: completion?.raw || {},
        sourcesText,
        nowYear: typeof nowYear === "function" ? nowYear() : nowYear,
        model: completion?.model || null,
      });
      finalized.analyzedAt = new Date().toISOString();
      finalized.analysisVersion = nextVersion(existing, force);
      if (!sourcesText.trim() && finalized.status === "complete") {
        finalized.status = "insufficient";
        finalized.summary = "Insufficient evidence";
      }

      await saveProfile(apartment.id, finalized);
      return { ran: true, reason: "analyzed", profile: finalized };
    } catch (error) {
      const failed = {
        ...(existing || emptyish(existing)),
        status: "failed",
        summary: error.message || "Building analysis failed.",
        analyzedAt: new Date().toISOString(),
        analysisVersion: existing?.analysisVersion || 0,
      };
      await saveProfile(apartment.id, failed);
      throw error;
    }
  }

  function nextVersion(existing, force) {
    if (force) return (existing?.analysisVersion || 0) + 1;
    return existing?.analysisVersion || ANALYSIS_VERSION;
  }

  function emptyish(existing) {
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
      overallIncomplete: true,
      missingCategories: ["safety", "buildingAge", "walkability", "viewsSun", "amenities"],
      amenities: [],
      facts: {},
      judgments: {},
      evidence: [],
      summary: null,
      status: "skipped",
      analysisVersion: existing?.analysisVersion || 0,
      model: null,
    };
  }

  return { analyze };
}

export function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
