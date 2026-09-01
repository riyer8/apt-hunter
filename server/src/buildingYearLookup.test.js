import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyYearBuiltLookup } from "../../shared/buildingProfile.js";
import { parseYearBuiltLookup } from "./buildingYearLookup.js";

describe("parseYearBuiltLookup", () => {
  it("accepts high-confidence years", () => {
    const result = parseYearBuiltLookup(
      { yearBuilt: 2019, confidence: "high", source: "Opened in 2019 per developer site." },
      2026,
    );
    assert.equal(result.yearBuilt, 2019);
    assert.match(result.source, /high/i);
  });

  it("rejects low-confidence guesses", () => {
    assert.equal(parseYearBuiltLookup({ yearBuilt: 2019, confidence: "low", source: "maybe" }, 2026), null);
  });
});

describe("applyYearBuiltLookup", () => {
  it("fills year built and recomputes age score", () => {
    const profile = applyYearBuiltLookup(
      {
        safetyScore: 8,
        walkabilityScore: 7,
        viewsSunScore: 6,
        amenitiesScore: 7,
        yearBuilt: null,
        buildingAgeScore: null,
        facts: {},
        judgments: {},
        evidence: [],
      },
      { yearBuilt: 2021, source: "OpenAI (high): permit records" },
      2026,
    );
    assert.equal(profile.yearBuilt, 2021);
    assert.equal(profile.buildingAge, 5);
    assert.equal(profile.buildingAgeScore, 9.4);
  });
});
