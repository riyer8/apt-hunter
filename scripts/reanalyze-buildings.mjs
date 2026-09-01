#!/usr/bin/env node
/**
 * Re-score every building profile from scratch (new analysis_version per building).
 * Usage: npm run reanalyze-buildings
 *        npm run reanalyze-buildings -- --dry-run
 *        npm run reanalyze-buildings -- --failed-only
 */
import { reanalyzeAllBuildingProfiles } from "../server/src/buildingAnalyze.js";
import { pool } from "../server/src/db.js";

const dryRun = process.argv.includes("--dry-run");
const failedOnly = process.argv.includes("--failed-only");

if (!dryRun && !process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set in server/.env");
  process.exit(1);
}

console.log(
  dryRun
    ? `Dry run — ${failedOnly ? "failed" : "all"} buildings that would be re-scored:`
    : `Re-scoring ${failedOnly ? "failed" : "all"} building profiles from scratch…`,
);

const results = await reanalyzeAllBuildingProfiles({
  dryRun,
  failedOnly,
  onProgress({ index, total, apartment, status, error, profile }) {
    if (status === "start") {
      console.log(`[${index}/${total}] ${apartment.name}`);
      return;
    }
    if (status === "done") {
      const score = profile?.overallScore != null ? profile.overallScore : "—";
      console.log(`  ✓ overall ${score} (v${profile?.analysisVersion ?? "?"})`);
      return;
    }
    if (status === "error") {
      console.error(`  ✗ ${error?.message || error}`);
    }
  },
});

const ok = results.filter((item) => item.ok).length;
const failed = results.filter((item) => !item.ok).length;
console.log(`\nFinished: ${ok} ok, ${failed} failed, ${results.length} total`);

await pool.end();
process.exit(failed > 0 ? 1 : 0);
