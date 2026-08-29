#!/usr/bin/env node
/**
 * Batch audit: can AptWatch extract listings from each URL?
 * Usage: node scripts/scrape-audit.mjs [--name=Building] [--limit=N]
 */
import { writeFileSync } from "node:fs";
import { scrapeApartment, closeBrowser } from "../server/src/scraper.js";

import SF_BUILDINGS from "../data/sf-buildings.json" with { type: "json" };

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--name="))?.slice(7);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) || 0);

let targets = SF_BUILDINGS;
if (only) targets = SF_BUILDINGS.filter((b) => b.name.toLowerCase().includes(only.toLowerCase()));
if (limit > 0) targets = targets.slice(0, limit);

const results = [];
const resultsPath = new URL("../data/scrape-audit-results.json", import.meta.url);

for (const building of targets) {
  const started = Date.now();
  const url = building.availabilityUrl || building.url;
  process.stderr.write(`Testing ${building.name}…\n`);
  try {
    const result = await scrapeApartment({ name: building.name, url });
    const sample = result.listings?.[0];
    results.push({
      name: building.name,
      url,
      hint: building.note || null,
      outcome: result.outcome,
      count: result.listings?.length || 0,
      method: result.extractionMethod,
      error: result.errorMessage,
      sample: sample
        ? { unit: sample.unit, price: sample.price, beds: sample.bedrooms, sqft: sample.sqft }
        : null,
      ms: Date.now() - started,
    });
  } catch (error) {
    results.push({
      name: building.name,
      url,
      hint: building.note || null,
      outcome: "ERROR",
      count: 0,
      error: error.message,
      ms: Date.now() - started,
    });
  }
}

await closeBrowser();
writeFileSync(resultsPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));

const ok = results.filter((r) => r.outcome === "SUCCESS" || r.outcome === "PARTIAL");
const fail = results.filter((r) => r.outcome !== "SUCCESS" && r.outcome !== "PARTIAL");

console.log("\n=== SCRAPE AUDIT ===\n");
for (const row of results) {
  const mark = row.outcome === "SUCCESS" || row.outcome === "PARTIAL" ? "✓" : "○";
  const hint = row.hint ? ` (${row.hint})` : "";
  console.log(
    `${mark} ${row.name}: ${row.outcome} (${row.count})${hint} ${row.error ? `— ${row.error}` : ""} [${Math.round(row.ms / 1000)}s]`,
  );
}
console.log(`\n${ok.length}/${results.length} extract listings\n`);
if (fail.length) {
  console.log("Need attention:");
  for (const row of fail) console.log(`  - ${row.name}: ${row.url}`);
}
console.log(`\nFull results: data/scrape-audit-results.json`);
