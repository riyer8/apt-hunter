#!/usr/bin/env node
/**
 * Run AptWatch's automated checks and print a human-readable summary.
 *
 * Usage:
 *   npm run verify          # unit tests + layout fixtures (fast, ~5s)
 *   npm run verify:live     # above + API smoke test (needs backend running)
 *   npm run verify:audit    # above + live scrape of all SF buildings (~4 min)
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv.includes("--audit") ? "audit" : process.argv.includes("--live") ? "live" : "fast";
const API_URL = process.env.VITE_API_URL || process.env.API_URL || "http://127.0.0.1:8787";

const results = [];

function run(command, args, { cwd = root, label } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ label, ok: code === 0, stdout, stderr, code });
    });
  });
}

async function apiHealthy() {
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

function printHeader(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(title);
  console.log("=".repeat(60));
}

// 1. Unit tests
printHeader("1. Server unit tests (logic — no network)");
const unit = await run("npm", ["test"], { cwd: join(root, "server"), label: "unit" });
const unitMatch = unit.stdout.match(/# pass (\d+)/);
const unitFail = unit.stdout.match(/# fail (\d+)/);
const unitPass = unitMatch ? Number(unitMatch[1]) : 0;
const unitFailed = unitFail ? Number(unitFail[1]) : 0;
results.push({
  name: "Server unit tests",
  status: unit.ok ? "PASS" : "FAIL",
  detail: unit.ok ? `${unitPass} tests passed` : `exit code ${unit.code}`,
});
console.log(unit.ok ? `✓ ${unitPass} tests passed` : `✗ Unit tests failed`);

// 2. Layout fixtures
printHeader("2. Layout fixtures (saved HTML — no network)");
const layouts = await run("node", ["scripts/test/test-layouts.mjs"], { label: "layouts" });
let layoutReports = [];
try {
  layoutReports = JSON.parse(layouts.stdout);
} catch {
  // parse failed
}
const layoutOk = layoutReports.filter((row) => row.listingCount > 0).length;
const layoutTotal = layoutReports.length;
results.push({
  name: "Layout fixtures",
  status: layouts.ok && layoutOk === layoutTotal ? "PASS" : "FAIL",
  detail: `${layoutOk}/${layoutTotal} site layouts extract listings`,
});
for (const row of layoutReports) {
  const mark = row.listingCount > 0 ? "✓" : "○";
  console.log(`${mark} ${row.name} — ${row.listingCount} listings (${row.outcome})`);
}

// 3. Smoke (live mode)
if (mode === "live" || mode === "audit") {
  printHeader("3. API smoke test (needs backend at " + API_URL + ")");
  if (await apiHealthy()) {
    const smoke = await run("node", ["scripts/smoke.mjs"], { label: "smoke" });
    results.push({
      name: "API smoke test",
      status: smoke.ok ? "PASS" : "FAIL",
      detail: smoke.ok ? "health, apartments, preferences, changes" : `exit code ${smoke.code}`,
    });
    console.log(smoke.ok ? "✓ All smoke checks passed" : "✗ Smoke test failed");
    if (!smoke.ok && smoke.stderr) console.log(smoke.stderr.trim());
  } else {
    results.push({ name: "API smoke test", status: "SKIP", detail: "API not running — start with npm run dev" });
    console.log("○ Skipped — API not running (npm run dev)");
  }
}

// 4. Live scrape audit
if (mode === "audit") {
  printHeader("4. Live scrape audit (20 SF buildings — real browser, ~4 min)");
  const audit = await run("node", ["scripts/audit/scrape-audit.mjs"], { label: "audit" });
  console.log(audit.stdout.trim() || audit.stderr.trim());
  try {
    const data = JSON.parse(readFileSync(join(root, "data/scrape-audit-results.json"), "utf8"));
    const ok = data.results.filter((row) => row.outcome === "SUCCESS" || row.outcome === "PARTIAL");
    const fail = data.results.filter((row) => row.outcome !== "SUCCESS" && row.outcome !== "PARTIAL");
    results.push({
      name: "Live scrape audit",
      status: fail.length === 0 ? "PASS" : fail.length <= 2 ? "PARTIAL" : "FAIL",
      detail: `${ok.length}/${data.results.length} buildings extract listings`,
    });
    if (fail.length) {
      console.log("\nBuildings that need attention:");
      for (const row of fail) console.log(`  ○ ${row.name}: ${row.error || row.outcome}`);
    }
  } catch {
    results.push({ name: "Live scrape audit", status: audit.ok ? "PASS" : "FAIL", detail: "see output above" });
  }
}

// Summary
printHeader("Summary");
for (const row of results) {
  const icon = row.status === "PASS" ? "✓" : row.status === "PARTIAL" ? "~" : row.status === "SKIP" ? "○" : "✗";
  console.log(`${icon} ${row.name}: ${row.status} — ${row.detail}`);
}

const failed = results.some((row) => row.status === "FAIL");
console.log(failed ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
