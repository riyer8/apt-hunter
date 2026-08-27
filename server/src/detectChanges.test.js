import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHANGE_TYPE, REMOVAL_THRESHOLD, dedupeByIdentity, listingIdentityKey, planScrape } from "./detectChanges.js";
import { listingIdentityKey as identityFromModule } from "./identity.js";

describe("listing identity", () => {
  it("prefers unit and ignores price", () => {
    assert.equal(listingIdentityKey({ unit: "1204", price: 4200 }), "unit:1204");
    assert.equal(listingIdentityKey({ unit: "1204", price: 3950 }), "unit:1204");
    assert.equal(identityFromModule({ unit: "1204", price: 1 }), "unit:1204");
  });

  it("falls back to listing URL when unit is missing", () => {
    assert.equal(
      listingIdentityKey({ listingUrl: "https://example.com/units/A1/" }),
      "url:https://example.com/units/a1",
    );
  });
});

describe("planScrape", () => {
  const unit = (id, extra = {}) => ({ unit: id, price: 4000, availableDate: "2026-09-25", ...extra });

  it("1. first scrape marks every listing NEW", () => {
    const plan = planScrape({
      previousListings: [],
      incomingListings: [unit("1204"), unit("908")],
      outcome: "SUCCESS",
    });
    assert.deepEqual(
      plan.events.map((event) => event.type),
      [CHANGE_TYPE.NEW, CHANGE_TYPE.NEW],
    );
  });

  it("2. second identical scrape creates no changes", () => {
    const previous = [
      { identity_key: "unit:1204", unit: "1204", price: 4000, available_date: "2026-09-25", is_active: true },
    ];
    const plan = planScrape({
      previousListings: previous,
      incomingListings: [unit("1204")],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events.length, 0);
  });

  it("3. a new unit is NEW", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4000, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("1204"), unit("1412")],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events.length, 1);
    assert.equal(plan.events[0].type, CHANGE_TYPE.NEW);
    assert.equal(plan.events[0].unit, "1412");
  });

  it("4. a lower price is PRICE_DROP", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4200, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("1204", { price: 3950 })],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events[0].type, CHANGE_TYPE.PRICE_DROP);
    assert.equal(plan.events[0].details.priceChange, -250);
    assert.equal(plan.events[0].details.priceChangePercent, -5.95);
  });

  it("5. a higher price is PRICE_INCREASE", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 3950, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("1204", { price: 4100 })],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events[0].type, CHANGE_TYPE.PRICE_INCREASE);
    assert.equal(plan.events[0].details.priceChange, 150);
  });

  it("6. a different date is AVAILABILITY_CHANGED", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4000, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("1204", { availableDate: "2026-09-20" })],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events[0].type, CHANGE_TYPE.AVAILABILITY_CHANGED);
    assert.equal(plan.events[0].previousValue, "2026-09-25");
    assert.equal(plan.events[0].newValue, "2026-09-20");
  });

  it("7. a unit missing from one successful scrape is not removed yet", () => {
    const plan = planScrape({
      previousListings: [
        {
          identity_key: "unit:1204",
          unit: "1204",
          price: 4000,
          available_date: "2026-09-25",
          is_active: true,
          missing_success_count: 0,
        },
      ],
      incomingListings: [],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events.some((event) => event.type === CHANGE_TYPE.REMOVED), false);
    assert.equal(plan.removals[0].isActive, true);
    assert.equal(plan.removals[0].missingSuccessCount, 1);
  });

  it("7b. a unit missing from consecutive successful scrapes is REMOVED", () => {
    const plan = planScrape({
      previousListings: [
        {
          identity_key: "unit:1204",
          unit: "1204",
          price: 4000,
          available_date: "2026-09-25",
          is_active: true,
          missing_success_count: REMOVAL_THRESHOLD - 1,
        },
      ],
      incomingListings: [],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events[0].type, CHANGE_TYPE.REMOVED);
    assert.equal(plan.removals[0].isActive, false);
  });

  it("8. a failed scrape does not remove or change listings", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4000, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("9999")],
      outcome: "FAILED",
    });
    assert.equal(plan.applyListings, false);
    assert.equal(plan.events.length, 0);
    assert.equal(plan.removals.length, 0);
  });

  it("partial scrape does not mark missing units removed", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4000, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [],
      outcome: "PARTIAL",
    });
    assert.equal(plan.applyListings, true);
    assert.equal(plan.detectRemovals, false);
    assert.equal(plan.events.some((event) => event.type === CHANGE_TYPE.REMOVED), false);
  });

  it("9. the same unit with a new price is the same listing, not NEW", () => {
    const plan = planScrape({
      previousListings: [
        { identity_key: "unit:1204", unit: "1204", price: 4200, available_date: "2026-09-25", is_active: true },
      ],
      incomingListings: [unit("1204", { price: 3950 })],
      outcome: "SUCCESS",
    });
    assert.equal(plan.events.some((event) => event.type === CHANGE_TYPE.NEW), false);
    assert.equal(plan.events[0].type, CHANGE_TYPE.PRICE_DROP);
    assert.equal(plan.incomingByKey.get("unit:1204").identityKey, "unit:1204");
  });

  it("10. duplicate listings in one scrape collapse to one row", () => {
    const map = dedupeByIdentity([
      unit("1204", { price: 4200 }),
      unit("1204", { price: 3950 }),
    ]);
    assert.equal(map.size, 1);
    assert.equal(map.get("unit:1204").price, 4200);
  });
});
