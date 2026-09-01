import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTR, defaultUserPrefs, matchListing, matchListingAgainstProfiles } from "../../shared/match.js";

const listing = {
  id: "lst-1204",
  apartmentName: "The George",
  unit: "1204",
  price: 3995,
  bedrooms: 1,
  bathrooms: 1,
  sqft: 620,
  availableDate: "2026-09-20",
  location: "SoMa, San Francisco",
  features: {
    laundry: ATTR.YES,
    parking: ATTR.UNKNOWN,
    gym: ATTR.YES,
  },
};

const prefs = defaultUserPrefs({
  maxRent: 4200,
  bedrooms: [0, 1],
  minBathrooms: 1,
  minSqft: 500,
  moveInEarliest: "2026-09-01",
  moveInLatest: "2026-10-01",
  preferredFeatures: ["laundry", "parking", "gym"],
  preferredNeighborhoods: ["SoMa"],
});

describe("matchListing", () => {
  it("1. a listing that satisfies all requirements gets a high match", () => {
    const match = matchListing(listing, prefs);
    assert.equal(match.qualifies, true);
    assert.ok(match.score >= 80, `expected high score, got ${match.score}`);
    assert.match(match.headline, /MATCH/);
    const rent = match.checks.find((item) => item.id === "maxRent");
    assert.equal(rent.status, "pass");
    assert.equal(rent.summary, "Under budget");
  });

  it("2. a listing that violates a hard requirement does not qualify", () => {
    const match = matchListing({ ...listing, price: 4500 }, prefs);
    assert.equal(match.qualifies, false);
    assert.equal(match.score, 0);
    assert.equal(match.headline, "DOES NOT QUALIFY");
    const rent = match.checks.find((item) => item.id === "maxRent");
    assert.equal(rent.status, "fail");
    assert.equal(rent.hard, true);
  });

  it("3. an unknown attribute is UNKNOWN, not NO", () => {
    const match = matchListing(listing, prefs);
    const parking = match.checks.find((item) => item.id === "feature:parking");
    assert.equal(parking.status, "unknown");
    assert.match(parking.detail, /UNKNOWN, not no/i);
    assert.equal(match.qualifies, true);
    const requiredUnknown = matchListing(listing, {
      ...prefs,
      requiredFeatures: ["parking"],
      preferredFeatures: ["laundry", "gym"],
    });
    const required = requiredUnknown.checks.find((item) => item.id === "feature:parking");
    assert.equal(required.status, "unknown");
    assert.equal(requiredUnknown.qualifies, true);
  });

  it("4. a missing price cannot pass the budget requirement", () => {
    const match = matchListing({ ...listing, price: null }, prefs);
    assert.equal(match.qualifies, false);
    const rent = match.checks.find((item) => item.id === "maxRent");
    assert.equal(rent.status, "fail");
    assert.match(rent.summary, /cannot pass budget/i);
  });

  it("5. missing sqft is marked unknown", () => {
    const match = matchListing({ ...listing, sqft: null }, prefs);
    const size = match.checks.find((item) => item.id === "sqft");
    assert.equal(size.status, "unknown");
    assert.equal(size.summary, "Size unknown");
    assert.notEqual(size.status, "fail");
    assert.equal(match.qualifies, true);
  });

  it("6. a move-in date inside the range matches", () => {
    const match = matchListing(listing, prefs);
    const move = match.checks.find((item) => item.id === "moveIn");
    assert.equal(move.status, "pass");
    assert.equal(move.summary, "Move-in date works");
  });

  it("7. a move-in date outside the range fails", () => {
    const match = matchListing({ ...listing, availableDate: "2026-11-01" }, prefs);
    assert.equal(match.qualifies, false);
    const move = match.checks.find((item) => item.id === "moveIn");
    assert.equal(move.status, "fail");
  });

  it("8. preferred amenities increase the score", () => {
    const basePrefs = defaultUserPrefs({
      maxRent: 4200,
      preferredFeatures: ["laundry", "parking"],
    });
    const withLaundry = matchListing({ ...listing, features: { laundry: ATTR.YES, parking: ATTR.UNKNOWN } }, basePrefs);
    const without = matchListing(
      { ...listing, features: { laundry: ATTR.UNKNOWN, parking: ATTR.UNKNOWN } },
      basePrefs,
    );
    assert.ok(withLaundry.score > without.score, `${withLaundry.score} should beat ${without.score}`);
  });

  it("9. changing preferences recalculates scores", () => {
    const first = matchListing(listing, prefs);
    const second = matchListing(listing, defaultUserPrefs({ maxRent: 3500 }));
    assert.equal(first.qualifies, true);
    assert.equal(second.qualifies, false);
    assert.notEqual(first.score, second.score);
  });

  it("10. the same listing and preferences always produce the same score", () => {
    const a = matchListing(listing, prefs);
    const b = matchListing(listing, prefs);
    assert.deepEqual(a, b);
  });

  it("11. newer buildings score higher when building age is known", () => {
    const basePrefs = defaultUserPrefs({ maxRent: 4200 });
    const newer = matchListing(
      { ...listing, buildingProfile: { yearBuilt: 2022, buildingAge: 4, buildingAgeScore: 9.5 } },
      basePrefs,
    );
    const older = matchListing(
      { ...listing, buildingProfile: { yearBuilt: 1985, buildingAge: 41, buildingAgeScore: 5.1 } },
      basePrefs,
    );
    assert.ok(newer.score > older.score, `${newer.score} should beat ${older.score}`);
    const ageCheck = newer.checks.find((item) => item.id === "buildingAge");
    assert.equal(ageCheck.status, "pass");
  });
});

const studioHunt = defaultUserPrefs({
  id: "studio",
  name: "Studio",
  maxRent: 4000,
  bedrooms: [0],
  minBathrooms: 1,
});

const twoBedHunt = defaultUserPrefs({
  id: "two-bed",
  name: "2 bed 2 bath",
  maxRent: 5600,
  bedrooms: [2],
  minBathrooms: 2,
  minSqft: 800,
});

const hunts = [studioHunt, twoBedHunt];

describe("matchListingAgainstProfiles", () => {
  it("a studio listing matches the studio hunt, not the 2-bed hunt", () => {
    const studio = {
      price: 3595,
      bedrooms: 0,
      bathrooms: 1,
      sqft: 472,
      availableDate: "now",
    };
    const match = matchListingAgainstProfiles(studio, hunts);
    assert.equal(match.qualifies, true);
    assert.equal(match.profileName, "Studio");
    assert.match(match.headline, /Studio/);
    const twoBed = match.profiles.find((item) => item.name === "2 bed 2 bath");
    assert.equal(twoBed.qualifies, false);
  });

  it("a 2-bed listing matches the 2-bed hunt, not the studio hunt", () => {
    const twoBed = {
      price: 5290,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 910,
      availableDate: "now",
    };
    const match = matchListingAgainstProfiles(twoBed, hunts);
    assert.equal(match.qualifies, true);
    assert.equal(match.profileName, "2 bed 2 bath");
    const studio = match.profiles.find((item) => item.name === "Studio");
    assert.equal(studio.qualifies, false);
  });

  it("when two hunts qualify, the higher score wins", () => {
    const flexible = [
      defaultUserPrefs({ name: "Any 1 bed", maxRent: 5000, bedrooms: [1] }),
      defaultUserPrefs({ name: "Cheap 1 bed", maxRent: 4200, bedrooms: [1], preferredFeatures: ["parking"] }),
    ];
    const oneBed = { ...listing, features: { gym: ATTR.YES } };
    const match = matchListingAgainstProfiles(oneBed, flexible);
    assert.equal(match.qualifies, true);
    assert.ok(match.profiles.every((item) => item.qualifies));
    const best = Math.max(...match.profiles.map((item) => item.score));
    assert.equal(match.score, best);
  });

  it("a listing that fails every hunt does not qualify", () => {
    const match = matchListingAgainstProfiles({ price: 8000, bedrooms: 3, bathrooms: 1, sqft: 400 }, hunts);
    assert.equal(match.qualifies, false);
    assert.equal(match.headline, "DOES NOT QUALIFY");
    assert.ok(match.profiles.every((item) => item.qualifies === false));
  });
});
