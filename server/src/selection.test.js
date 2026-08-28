import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apartmentPassesSelection, listingPassesSelection } from "../../shared/selection.js";

describe("apartmentPassesSelection", () => {
  const apartment = { id: "1", isFavorite: true, isWatchlisted: false, isDiscarded: false };

  it("hides discarded buildings by default", () => {
    assert.equal(apartmentPassesSelection({ ...apartment, isDiscarded: true }, {}), false);
    assert.equal(apartmentPassesSelection({ ...apartment, isDiscarded: true }, { showDiscarded: true }), true);
  });

  it("filters favorites and watchlist scopes", () => {
    assert.equal(apartmentPassesSelection(apartment, { selectionScope: "favorite" }), true);
    assert.equal(apartmentPassesSelection(apartment, { selectionScope: "watchlist" }), false);
    assert.equal(
      apartmentPassesSelection({ ...apartment, isWatchlisted: true }, { selectionScope: "watchlist" }),
      true,
    );
  });
});

describe("listingPassesSelection", () => {
  const listing = { id: "l1", isFavorite: false, isWatchlisted: true, isDiscarded: false };

  it("hides discarded units by default", () => {
    assert.equal(listingPassesSelection({ ...listing, isDiscarded: true }, {}), false);
    assert.equal(listingPassesSelection({ ...listing, isDiscarded: true }, { showDiscarded: true }), true);
  });

  it("filters favorite and watchlist units", () => {
    assert.equal(listingPassesSelection(listing, { selectionScope: "watchlist" }), true);
    assert.equal(listingPassesSelection(listing, { selectionScope: "favorite" }), false);
  });
});
