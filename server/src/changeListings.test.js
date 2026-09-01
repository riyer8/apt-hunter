import test from "node:test";
import assert from "node:assert/strict";
import { countChangesByType, filterRecentChanges } from "../../shared/changeListings.js";

test("filterRecentChanges keeps only events in the last 48 hours", () => {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
  const changes = [
    { changeType: "PRICE_DROP", detectedAt: "2026-08-31T10:00:00.000Z" },
    { changeType: "NEW", detectedAt: "2026-08-28T10:00:00.000Z" },
  ];
  const recent = filterRecentChanges(changes, now);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].changeType, "PRICE_DROP");
});

test("countChangesByType matches filtered list length per type", () => {
  const changes = [
    { changeType: "PRICE_DROP" },
    { changeType: "PRICE_DROP" },
    { changeType: "NEW" },
  ];
  const counts = countChangesByType(changes);
  assert.equal(counts.PRICE_DROP, 2);
  assert.equal(counts.NEW, 1);
  assert.equal(counts.REMOVED, 0);
});
