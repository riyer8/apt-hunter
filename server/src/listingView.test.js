import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listingMatchesFilters, sortListings, sortListingsWithCuratedPriority } from "../../shared/listingView.js";

const george = (unit, price, profile) => ({
  unit,
  price,
  apartmentName: "The George",
  buildingProfile: profile,
  match: { score: 80 },
});

const profile = {
  safetyScore: 8.7,
  buildingAgeScore: 9.4,
  walkabilityScore: 9.5,
  viewsSunScore: 8.1,
  amenitiesScore: 9.0,
  overallScore: 9.0,
};

describe("building score listing view", () => {
  it("4–5. filters by min safety/walkability and sorts by building scores", () => {
    const listings = [
      george("1204", 3995, profile),
      george("404", 3595, { ...profile, safetyScore: 6.2, walkabilityScore: 7.1, overallScore: 7.5 }),
    ];
    const filtered = listings.filter((listing) =>
      listingMatchesFilters(listing, { minSafety: 8, minWalkability: 8 }),
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].unit, "1204");

    const bySafety = sortListings(listings, "safety");
    assert.equal(bySafety[0].unit, "1204");
    const byPrice = sortListings(listings, "price");
    assert.equal(byPrice[0].unit, "404");
  });

  it("6. unknown building scores do not pass a minimum filter", () => {
    const listing = george("1", 2000, { safetyScore: null, walkabilityScore: 9 });
    assert.equal(listingMatchesFilters(listing, { minSafety: 8 }), false);
  });

  it("7. favorites and watchlist float to the top of the unit table", () => {
    const listings = [
      { unit: "101", price: 3000 },
      { unit: "202", price: 2500, isFavorite: true },
      { unit: "303", price: 2800, isWatchlisted: true },
      { unit: "404", price: 2000, isFavorite: true },
    ];
    const ordered = sortListingsWithCuratedPriority(listings, "price");
    assert.deepEqual(
      ordered.map((listing) => listing.unit),
      ["404", "202", "303", "101"],
    );
  });
});
