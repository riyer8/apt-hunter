import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getScheduleConfig } from "./schedule.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const EXTRACTOR_FILES = [
  "src/analyzer/page/namespace.js",
  "src/analyzer/page/fields.js",
  "src/analyzer/page/extractors/json.js",
  "src/analyzer/page/extractors/jsData.js",
  "src/analyzer/page/extractors/html.js",
  "src/analyzer/page/extractors/text.js",
  "src/analyzer/page/extractors/api.js",
  "src/analyzer/page/run.js",
];

const PAGE_STATE = "src/analyzer/page/pageState.js";
const LOAD_TIMEOUT_MS = 45000;
const RENDER_WAIT_MS = 6000;
const RETRY_WAIT_MS = 4000;

let browserPromise = null;
let classifyModule = null;

export async function scrapeApartment(apartment) {
  const url = apartment.source_url || apartment.url;
  if (!url) throw new Error("This apartment has no availability URL.");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await scrapeApartmentOnce(apartment, url);
    } catch (error) {
      const message = String(error?.message || error);
      const browserDead = /has been closed|browser has been closed|Target page, context or browser/i.test(message);
      if (!browserDead || attempt === 1) throw error;
      await resetBrowser();
    }
  }
  throw new Error("Scrape failed.");
}

async function scrapeApartmentOnce(apartment, url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();
  const startedAt = new Date().toISOString();

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT_MS });
    assertNotBlocked(response, await page.title());

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await sleep(RENDER_WAIT_MS);

    let extracted = await extractFromPage(page);
    if (!extracted.candidates.length) {
      await sleep(RETRY_WAIT_MS);
      extracted = await extractFromPage(page);
    }

    const { classify, diagnose, nullsToNull } = await loadAnalyzer();
    const now = new Date().toISOString();
    const diagnosis = diagnose(extracted.candidates, {
      apartmentName: apartment.name || extracted.apartmentName,
      sourceUrl: url,
      previousListings: [],
      now,
    }, { strategyResults: extracted.strategyResults || [] });
    const listings = diagnosis.listings.map(nullsToNull);
    const classified = classify(listings);

    if (classified.outcome === "FAILED") {
      return {
        outcome: "FAILED",
        listings: [],
        extractionMethod: classified.strategies?.join(" + ") || "none",
        errorMessage: classified.headline || "Could not detect availability.",
        startedAt,
      };
    }

    return {
      outcome: classified.outcome,
      listings,
      extractionMethod: classified.strategies?.join(" + ") || null,
      errorMessage: null,
      startedAt,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function assertNotBlocked(response, title) {
  const status = response?.status?.() ?? response?.status;
  if (status === 401 || status === 403 || status === 429) {
    throw new Error(`Site blocked automated access (${status}).`);
  }
  if (/captcha|attention required|access denied|unusual traffic/i.test(String(title || ""))) {
    throw new Error("Site presented a CAPTCHA or access block. AptWatch will not try to bypass it.");
  }
}

async function extractFromPage(page) {
  const candidates = [];
  const strategyResults = [];
  let pageUrl = "";
  let apartmentName = "";

  for (const frame of page.frames()) {
    try {
      await injectScripts(frame);
      const payload = await frame.evaluate(() => {
        const analyzer = globalThis.AptWatchAnalyzer;
        return analyzer?.run ? analyzer.run() : { candidates: [], strategyResults: [], pageUrl: location.href };
      });
      if (!payload) continue;
      pageUrl = payload.pageUrl || pageUrl;
      apartmentName = payload.apartmentName || apartmentName;
      if (payload.candidates) candidates.push(...payload.candidates);
      if (payload.strategyResults) strategyResults.push(...payload.strategyResults);
    } catch {
      // Cross-origin or empty frames are skipped.
    }
  }

  return { candidates, strategyResults, pageUrl, apartmentName };
}

async function injectScripts(frame) {
  const files = [PAGE_STATE, ...EXTRACTOR_FILES];
  for (const relative of files) {
    const content = readFileSync(join(root, relative), "utf8");
    await frame.addScriptTag({ content });
  }
}

async function loadAnalyzer() {
  if (classifyModule) return classifyModule;
  const classifyUrl = pathToFileURL(join(root, "src/analyzer/classify.js")).href;
  const diagnosticsUrl = pathToFileURL(join(root, "src/analyzer/diagnostics.js")).href;
  const listingsUrl = pathToFileURL(join(root, "src/analyzer/listings.js")).href;
  const [{ classify }, { diagnose }, { nullsToNull }] = await Promise.all([
    import(classifyUrl),
    import(diagnosticsUrl),
    import(listingsUrl),
  ]);
  classifyModule = { classify, diagnose, nullsToNull };
  return classifyModule;
}

export async function resetBrowser() {
  const current = browserPromise;
  browserPromise = null;
  if (!current) return;
  const browser = await current.catch(() => null);
  if (browser) await browser.close().catch(() => {});
}

export async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser?.isConnected?.()) return browser;
    await resetBrowser();
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

async function launchBrowser() {
  const { chromium } = await import("playwright-core");
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      throw new Error(
        "Could not launch Chrome for scheduled scraping. Install Google Chrome, or run `npx playwright install chromium` in server/.",
      );
    }
  }
}

export async function closeBrowser() {
  await resetBrowser();
}

export function schedulerPublicStatus() {
  const config = getScheduleConfig();
  return {
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    intervalMinutes: Math.round(config.intervalMs / 60000),
    maxAttempts: config.maxAttempts,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
