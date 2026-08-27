import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { classify } from "../src/analyzer/classify.js";
import { buildDiagnosticReport, diagnose } from "../src/analyzer/diagnostics.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAGE_SCRIPTS = [
  "src/analyzer/page/namespace.js",
  "src/analyzer/page/fields.js",
  "src/analyzer/page/extractors/json.js",
  "src/analyzer/page/extractors/jsData.js",
  "src/analyzer/page/extractors/html.js",
  "src/analyzer/page/extractors/text.js",
  "src/analyzer/page/extractors/api.js",
  "src/analyzer/page/run.js",
];

export function extractFromHtml(html, { url, apartmentName }) {
  const dom = new JSDOM(html, { url, contentType: "text/html", runScripts: "outside-only" });
  const { window } = dom;
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
  });

  for (const file of [...PAGE_SCRIPTS, "src/analyzer/page/pageState.js"]) {
    window.eval(readFileSync(join(root, file), "utf8"));
  }

  const payload = window.AptWatchAnalyzer.run();
  const diagnosis = diagnose(
    payload.candidates,
    {
      apartmentName: apartmentName || payload.apartmentName || "Test Property",
      sourceUrl: url,
      previousListings: [],
      now: new Date().toISOString(),
    },
    { strategyResults: payload.strategyResults || [] },
  );
  const listings = diagnosis.listings;
  const result = classify(listings);

  return {
    payload,
    listings,
    result,
    diagnosis,
    report: buildDiagnosticReport({
      url,
      apartmentName: apartmentName || payload.apartmentName,
      diagnosis,
      classified: result,
    }),
  };
}
