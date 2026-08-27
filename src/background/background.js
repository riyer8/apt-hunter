import { classify } from "../analyzer/classify.js";
import { buildDiagnosticReport, diagnose } from "../analyzer/diagnostics.js";
import { nullsToNull } from "../analyzer/listings.js";
import {
  applyLedgerToListings,
  getApartment,
  getExtractedListings,
  saveExtractedListings,
  saveLastTestExtraction,
  STATUS,
  updateApartment,
  updateListingLedger,
} from "../lib/storage.js";

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

const LOAD_TIMEOUT_MS = 25000;
const RENDER_WAIT_MS = 4000;
const RETRY_WAIT_MS = 3500;
const TEST_LOCK = "__test_extraction__";

const analyzing = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log("AptWatch ready");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ANALYZE_APARTMENT") {
    analyzeApartment(message.id, message.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "TEST_EXTRACTION") {
    testExtraction(message.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

async function analyzeApartment(id, url) {
  if (analyzing.has(id)) {
    return { outcome: "PENDING" };
  }

  analyzing.add(id);
  await updateApartment(id, {
    status: STATUS.ANALYZING,
    analysis: { outcome: "ANALYZING", headline: "Analyzing…", details: [] },
  });

  const apartment = await getApartment(id);
  try {
    const previousListings = apartment?.listings?.length
      ? apartment.listings
      : await getExtractedListings(id);
    const extracted = await extractPage(url, {
      apartmentName: apartment?.name,
      previousListings,
    });
    const classified = extracted.classified;
    const savedListings = classified.listings.slice(0, 150).map(nullsToNull);
    const ledger = await updateListingLedger(savedListings);
    const listingsWithHistory = applyLedgerToListings(savedListings, ledger).map(nullsToNull);
    const analysis = {
      outcome: classified.outcome,
      headline: classified.headline,
      details: classified.details,
      listingCount: classified.listingCount,
      fieldsDetected: classified.fieldsDetected,
      strategies: classified.strategies,
      analyzedAt: extracted.report.analyzedAt,
      diagnostics: extracted.report,
    };

    await updateApartment(id, {
      status: statusFromOutcome(analysis.outcome),
      listings: listingsWithHistory,
      lastChecked: analysis.analyzedAt,
      analysis,
    });
    await saveExtractedListings(id, listingsWithHistory);
    return analysis;
  } catch (error) {
    const analysis = {
      ...classify([]),
      headline: "✕ Could not reliably detect apartment availability",
      details: [error.message],
      analyzedAt: new Date().toISOString(),
    };
    await updateApartment(id, {
      status: STATUS.FAILED,
      analysis,
    });
    return analysis;
  } finally {
    analyzing.delete(id);
  }
}

async function testExtraction(url) {
  if (analyzing.has(TEST_LOCK)) {
    return { outcome: "PENDING" };
  }

  analyzing.add(TEST_LOCK);
  await saveLastTestExtraction({
    url,
    outcome: "ANALYZING",
    headline: "Testing extraction…",
    summaryText: `URL: ${url}\nExtraction method: running…`,
  });

  try {
    const extracted = await extractPage(url, { apartmentName: "", previousListings: [] });
    await saveLastTestExtraction(extracted.report);
    return extracted.report;
  } catch (error) {
    const failed = {
      url,
      outcome: "FAILED",
      headline: "✕ Could not reliably detect apartment availability",
      extractionMethod: "none",
      listingsFound: 0,
      validListings: 0,
      duplicatesRemoved: 0,
      rejected: 0,
      fieldsDetected: [],
      confidence: "none",
      problems: [error.message],
      recommendedNextStep: "Reload the extension and try again. If the tab was blocked, grant access to the site.",
      strategies: [],
      listings: [],
      summaryText: `URL: ${url}\nExtraction method: none\nProblems:\n- ${error.message}`,
      analyzedAt: new Date().toISOString(),
    };
    await saveLastTestExtraction(failed);
    return failed;
  } finally {
    analyzing.delete(TEST_LOCK);
  }
}

async function extractPage(url, { apartmentName, previousListings }) {
  let tabId;
  let createdTab = false;
  const warnings = [];

  try {
    const tabInfo = await getOrOpenTab(url);
    tabId = tabInfo.tabId;
    createdTab = tabInfo.created;
    await waitForTabLoad(tabId);

    await chrome.scripting
      .executeScript({
        target: { tabId },
        func: () => window.scrollTo(0, document.body.scrollHeight),
      })
      .catch((error) => {
        warnings.push(`Scroll failed: ${error.message}`);
      });
    await sleep(RENDER_WAIT_MS);

    let extracted = await extractCandidatesFromTab(tabId);
    if (!extracted.candidates.length) {
      await sleep(RETRY_WAIT_MS);
      extracted = await extractCandidatesFromTab(tabId);
      if (extracted.candidates.length) warnings.push("First pass found nothing; retry after wait succeeded.");
    }

    const now = new Date().toISOString();
    const diagnosis = diagnose(extracted.candidates, {
      apartmentName: apartmentName || extracted.apartmentName,
      sourceUrl: url,
      previousListings: previousListings || [],
      now,
    }, {
      strategyResults: extracted.strategyResults || [],
      warnings,
    });
    const listings = diagnosis.listings.map(nullsToNull);
    const classified = classify(listings);
    const report = buildDiagnosticReport({
      url,
      apartmentName: apartmentName || extracted.apartmentName,
      diagnosis: { ...diagnosis, listings },
      classified,
      warnings,
    });

    return { listings, classified, diagnosis, report, extracted };
  } finally {
    if (createdTab && tabId != null) {
      chrome.tabs.remove(tabId).catch(() => {});
    }
  }
}

function urlsMatch(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const strip = (value) => `${value.origin}${value.pathname}`.replace(/\/+$/, "").toLowerCase();
    return strip(a) === strip(b);
  } catch {
    return false;
  }
}

async function getOrOpenTab(url) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url && urlsMatch(tab.url, url));
  if (existing?.id != null) {
    return { tabId: existing.id, created: false };
  }

  const tab = await chrome.tabs.create({ url, active: false });
  return { tabId: tab.id, created: true };
}

async function extractCandidatesFromTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: "MAIN",
    files: ["src/analyzer/page/pageState.js"],
  }).catch(() =>
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["src/analyzer/page/pageState.js"],
    }),
  );

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: EXTRACTOR_FILES,
  }).catch(() =>
    chrome.scripting.executeScript({
      target: { tabId },
      files: EXTRACTOR_FILES,
    }),
  );

  const frames = await chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const analyzer = globalThis.AptWatchAnalyzer;
        return analyzer?.run ? analyzer.run() : { candidates: [], strategyResults: [], pageUrl: location.href };
      },
    })
    .catch(() =>
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const analyzer = globalThis.AptWatchAnalyzer;
          return analyzer?.run ? analyzer.run() : { candidates: [], strategyResults: [], pageUrl: location.href };
        },
      }),
    );

  const candidates = [];
  const strategyResults = [];
  let pageUrl = "";
  let apartmentName = "";
  for (const frame of frames || []) {
    const payload = frame?.result;
    if (!payload) continue;
    pageUrl = payload.pageUrl || pageUrl;
    apartmentName = payload.apartmentName || apartmentName;
    if (payload.candidates) candidates.push(...payload.candidates);
    if (payload.strategyResults) strategyResults.push(...payload.strategyResults);
  }

  return { candidates, strategyResults, pageUrl, apartmentName };
}

function statusFromOutcome(outcome) {
  if (outcome === "SUCCESS") return STATUS.SUCCESS;
  if (outcome === "PARTIAL") return STATUS.PARTIAL;
  return STATUS.FAILED;
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => finish(new Error("Timed out loading the apartment page.")), LOAD_TIMEOUT_MS);

    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };

    const onRemoved = (id) => {
      if (id === tabId) finish(new Error("The apartment page tab was closed."));
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    chrome.tabs.get(tabId).then((tab) => {
      if (chrome.runtime.lastError) {
        finish(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (tab.status === "complete") finish();
    }).catch((error) => finish(error));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
