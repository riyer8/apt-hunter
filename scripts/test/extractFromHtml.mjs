import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { classify } from "../../extension/analyzer/classify.js";
import { buildDiagnosticReport, diagnose } from "../../extension/analyzer/diagnostics.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const PAGE_SCRIPTS = [
  "extension/analyzer/page/namespace.js",
  "extension/analyzer/page/fields.js",
  "extension/analyzer/page/extractors/json.js",
  "extension/analyzer/page/extractors/jsData.js",
  "extension/analyzer/page/extractors/html.js",
  "extension/analyzer/page/extractors/text.js",
  "extension/analyzer/page/extractors/api.js",
  "extension/analyzer/page/run.js",
];

export function extractFromHtml(html, { url, apartmentName }) {
  const dom = new JSDOM(html, { url, contentType: "text/html", runScripts: "outside-only" });
  const { window } = dom;
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
  });

  for (const file of [...PAGE_SCRIPTS, "extension/analyzer/page/pageState.js"]) {
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
