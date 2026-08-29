import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildingAgeScoreFromYear,
  extractConstructionYearFromSources,
  finalizeBuildingProfile,
  overallBuildingScore,
  scoreBand,
} from "../../shared/buildingProfile.js";
import { createBuildingIntelligence } from "./buildingIntelligence.js";

describe("building scores", () => {
  it("9. overall score is a weighted average and skips null categories", () => {
    const all = overallBuildingScore({
      safety: 8.7,
      buildingAge: 9.2,
      walkability: 9.5,
      viewsSun: 8.1,
      amenities: 9.0,
    });
    assert.equal(all.incomplete, false);
    assert.equal(all.score, 8.9);
    const partial = overallBuildingScore({
      safety: 8,
      buildingAge: null,
      walkability: 8,
      viewsSun: null,
      amenities: 10,
    });
    assert.equal(partial.incomplete, true);
    assert.ok(partial.missing.includes("buildingAge"));
    assert.equal(partial.score, 8.6);
  });

  it("6. missing information stays UNKNOWN rather than zero", () => {
    const none = overallBuildingScore({});
    assert.equal(none.score, null);
    assert.equal(scoreBand(null), "unknown");
  });

  it("building age score is derived from year built", () => {
    assert.equal(buildingAgeScoreFromYear(2021, 2026), 9.4);
    assert.equal(buildingAgeScoreFromYear(null, 2026), null);
  });
});

describe("finalizeBuildingProfile", () => {
  it("7. does not keep a construction year that is not in the sources", () => {
    const profile = finalizeBuildingProfile({
      raw: {
        facts: { yearBuilt: 1999, yearBuiltEvidence: "made it up" },
        judgments: { safety: { score: 8, insufficient: false } },
      },
      sourcesText: "A nice building in SoMa with a gym.",
      nowYear: 2026,
    });
    assert.equal(profile.yearBuilt, null);
    assert.equal(profile.buildingAgeScore, null);
    assert.equal(profile.safetyScore, 8);
  });

  it("keeps a construction year that is quoted in the sources", () => {
    const profile = finalizeBuildingProfile({
      raw: { facts: { yearBuilt: 2021, yearBuiltEvidence: "Built in 2021" }, judgments: {} },
      sourcesText: "The George. Built in 2021. 20 stories.",
      nowYear: 2026,
    });
    assert.equal(profile.yearBuilt, 2021);
    assert.equal(profile.buildingAge, 5);
    assert.equal(profile.buildingAgeScore, 9.4);
  });

  it("extracts a construction year from source text even when the model omits it", () => {
    const profile = finalizeBuildingProfile({
      raw: { facts: {}, judgments: {} },
      sourcesText: "NEMA is a luxury tower completed in 2014 with 754 homes.",
      nowYear: 2026,
    });
    assert.equal(profile.yearBuilt, 2014);
    assert.equal(profile.buildingAge, 12);
    assert.equal(profile.buildingAgeScore, 8.6);
  });

  it("falls back to a model buildingAge score when no year is found", () => {
    const profile = finalizeBuildingProfile({
      raw: {
        facts: {},
        judgments: {
          buildingAge: {
            score: 8.5,
            insufficient: false,
            rationale: "Described as a newer luxury high-rise.",
            evidence: "New construction with modern finishes.",
          },
        },
      },
      sourcesText: "Luxury apartments with a rooftop pool.",
      nowYear: 2026,
    });
    assert.equal(profile.yearBuilt, null);
    assert.equal(profile.buildingAgeScore, 8.5);
  });

  it("extractConstructionYearFromSources prefers built-in over renovated", () => {
    const extracted = extractConstructionYearFromSources(
      "Originally built in 1962. Fully renovated in 2018 with new amenities.",
      2026,
    );
    assert.equal(extracted.year, 1962);
  });

  it("accepts year built from model knowledge when trustModelFacts is set", () => {
    const profile = finalizeBuildingProfile({
      raw: { facts: { yearBuilt: 2018, yearBuiltEvidence: "Opened 2018" }, judgments: { safety: { score: 7, insufficient: false } } },
      sourcesText: "Name: Avalon Dogpatch",
      nowYear: 2026,
      trustModelFacts: true,
    });
    assert.equal(profile.yearBuilt, 2018);
    assert.equal(profile.buildingAgeScore, 9);
  });
});

describe("createBuildingIntelligence", () => {
  it("1. a new building runs analysis once", async () => {
    const store = new Map();
    let completes = 0;
    const intel = createBuildingIntelligence({
      loadProfile: async (id) => store.get(id) || null,
      saveProfile: async (id, profile) => store.set(id, profile),
      saveHistory: async () => {},
      gather: async () => [{ url: "https://example.com", text: "Built in 2021. Gym and rooftop." }],
      complete: async () => {
        completes += 1;
        return {
          model: "test",
          raw: {
            facts: { yearBuilt: 2021, amenities: ["gym", "rooftop"] },
            judgments: {
              safety: { score: 8.7 },
              walkability: { score: 9.5 },
              viewsSun: { score: 8.1 },
              amenities: { score: 9 },
            },
            summary: "Newer SoMa tower.",
          },
        };
      },
      nowYear: 2026,
    });
    const first = await intel.analyze({ id: "apt-1", name: "The George" });
    assert.equal(first.ran, true);
    assert.equal(completes, 1);
    assert.equal(first.profile.yearBuilt, 2021);
  });

  it("2–3. later listings on the same building do not run analysis again", async () => {
    const store = new Map();
    let completes = 0;
    const intel = createBuildingIntelligence({
      loadProfile: async (id) => store.get(id) || null,
      saveProfile: async (id, profile) => store.set(id, profile),
      gather: async () => [{ url: "https://example.com", text: "Built in 2021" }],
      complete: async () => {
        completes += 1;
        return { raw: { facts: { yearBuilt: 2021 }, judgments: { safety: { score: 8 } } } };
      },
      nowYear: 2026,
    });
    await intel.analyze({ id: "apt-1" });
    const second = await intel.analyze({ id: "apt-1" });
    const third = await intel.analyze({ id: "apt-1" });
    assert.equal(completes, 1);
    assert.equal(second.ran, false);
    assert.equal(third.ran, false);
    assert.equal(second.reason, "already-analyzed");
  });

  it("8. re-analyze creates a new analysis version", async () => {
    const store = new Map();
    const history = [];
    const intel = createBuildingIntelligence({
      loadProfile: async (id) => store.get(id) || null,
      saveProfile: async (id, profile) => store.set(id, profile),
      saveHistory: async (id, snapshot) => history.push({ id, snapshot }),
      gather: async () => [{ url: "https://example.com", text: "Built in 2021" }],
      complete: async () => ({ raw: { facts: { yearBuilt: 2021 }, judgments: { safety: { score: 8 } } } }),
      nowYear: 2026,
    });
    const first = await intel.analyze({ id: "apt-1" });
    const again = await intel.analyze({ id: "apt-1" }, { force: true });
    assert.equal(first.profile.analysisVersion, 1);
    assert.equal(again.ran, true);
    assert.equal(again.profile.analysisVersion, 2);
    assert.equal(history.length, 1);
  });

  it("10. removing or re-adding a listing does not trigger analysis when a profile exists", async () => {
    const store = new Map();
    let completes = 0;
    const intel = createBuildingIntelligence({
      loadProfile: async (id) => store.get(id) || null,
      saveProfile: async (id, profile) => store.set(id, profile),
      gather: async () => [{ url: "https://example.com", text: "Built in 2021" }],
      complete: async () => {
        completes += 1;
        return { raw: { facts: { yearBuilt: 2021 }, judgments: {} } };
      },
      nowYear: 2026,
    });
    await intel.analyze({ id: "apt-1" });
    const afterListingChurn = await intel.analyze({ id: "apt-1" }, { force: false });
    assert.equal(completes, 1);
    assert.equal(afterListingChurn.ran, false);
  });
});
