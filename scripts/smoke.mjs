#!/usr/bin/env node
/**
 * End-to-end smoke test against a running AptWatch API.
 * Usage: npm run smoke
 */
import assert from "node:assert/strict";

const API = process.env.VITE_API_URL || process.env.API_URL || "http://127.0.0.1:8787";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `${method} ${path} failed (${response.status})`);
  }
  return data;
}

function findListing(apartments) {
  for (const apartment of apartments) {
    for (const listing of apartment.listings || []) {
      if (listing.id) return { apartment, listing };
    }
  }
  return null;
}

console.log(`Smoke testing ${API}…`);

const health = await request("/health");
assert.equal(health.ok, true, "health ok");
assert.equal(typeof health.scheduler, "object", "scheduler status present");
console.log("✓ /health");

const wake = await request("/wake", { method: "POST" });
assert.equal(wake.ok, true, "wake ok");
console.log("✓ /wake");

const apartments = await request("/apartments");
assert.ok(Array.isArray(apartments), "apartments is an array");
console.log(`✓ /apartments (${apartments.length} buildings)`);

const target = findListing(apartments);
if (target) {
  const { apartment, listing } = target;

  const favorited = await request(`/listings/${listing.id}/selection`, {
    method: "POST",
    body: { favorite: true },
  });
  assert.equal(favorited.isFavorite, true, "listing favorite saved");
  console.log("✓ listing selection (favorite)");

  const refreshed = await request("/apartments");
  const saved = refreshed
    .flatMap((item) => item.listings || [])
    .find((item) => item.id === listing.id);
  assert.equal(saved?.isFavorite, true, "favorite persisted in apartments payload");
  assert.ok(saved?.buildingProfile != null || apartment.buildingProfile != null, "building profile attached");
  console.log("✓ favorite persisted + building profile on listings");

  const watchlisted = await request(`/apartments/${apartment.id}/selection`, {
    method: "POST",
    body: { watchlisted: true },
  });
  assert.equal(watchlisted.isWatchlisted, true, "apartment watchlist saved");
  console.log("✓ apartment selection (watchlist)");
} else {
  console.log("○ selection tests skipped (no listings yet — add a building and scrape to exercise them)");
}

const prefs = await request("/preferences");
assert.ok(prefs, "preferences payload");
console.log("✓ /preferences");

const changes = await request("/changes?limit=5");
assert.ok(Array.isArray(changes), "changes is an array");
console.log("✓ /changes");

console.log("\nAll smoke checks passed.");
