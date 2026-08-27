import {
  convertCandidate,
  dedupeListings,
  preferUnitIdentities,
  sortListings,
  applyPreviousSightings,
  populatedListingFields,
  collapsePrefixedUnits,
} from "./listings.js";

export const STRATEGY_ORDER = ["html", "jsonLd", "json", "api", "text", "jsData"];

export const STRATEGY_LABELS = {
  html: "Static HTML",
  jsonLd: "JSON-LD",
  json: "Embedded JSON",
  api: "API detection",
  text: "DOM extraction",
  jsData: "Page JS state",
};

const CHECKLIST_FIELDS = [
  { key: "unit", label: "Unit" },
  { key: "price", label: "Price", format: "price" },
  { key: "bedrooms", label: "Bedrooms", format: "beds" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "sqft", label: "Sqft" },
  { key: "availableDate", label: "Availability", format: "date" },
  { key: "listingUrl", label: "Listing URL", format: "url" },
];

export function diagnose(candidates, context, extras = {}) {
  const rejected = [];
  const converted = [];

  for (const candidate of candidates || []) {
    const { listing, reason, snippet } = convertCandidate(candidate, context);
    if (listing) {
      converted.push(listing);
      continue;
    }
    rejected.push({
      source: candidate.source || "unknown",
      reason: reason || "rejected",
      snippet: snippet || "",
    });
  }

  const beforeDedupe = converted.length;
  const deduped = dedupeListings(converted);
  const duplicatesRemoved = Math.max(0, beforeDedupe - deduped.length);

  const preferred = preferUnitIdentities(deduped);
  const collapsed = collapsePrefixedUnits(preferred);
  const droppedGeneric = deduped.filter((listing) => !collapsed.some((item) => item.id === listing.id));
  for (const listing of droppedGeneric) {
    rejected.push({
      source: listing.source || "unknown",
      reason: "generic floor-plan row dropped because unit-level listings exist",
      snippet: [listing.floorPlan, listing.price].filter(Boolean).join(" · "),
    });
  }

  const listings = sortListings(applyPreviousSightings(collapsed, context.previousListings));

  return {
    listings,
    counts: {
      candidates: (candidates || []).length,
      converted: converted.length,
      valid: listings.length,
      duplicatesRemoved,
      rejected: rejected.length,
    },
    rejected: rejected.slice(0, 40),
    strategyResults: extras.strategyResults || [],
    warnings: extras.warnings || [],
  };
}

export function buildDiagnosticReport({ url, apartmentName, diagnosis, classified, warnings = [] }) {
  const listings = diagnosis.listings || [];
  const strategyResults = completeStrategyResults(diagnosis.strategyResults || [], listings);
  const worked = strategyResults.filter((item) => item.worked).map((item) => item.label);
  const fieldsDetected = classified.fieldsDetected || [];
  const problems = collectProblems(diagnosis, classified, strategyResults, warnings);
  const extractionMethod = worked.length ? worked.join(" + ") : "none";
  const confidenceCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const listing of listings) {
    confidenceCounts[listing.confidence] = (confidenceCounts[listing.confidence] || 0) + 1;
  }
  const confidenceLabel = ["HIGH", "MEDIUM", "LOW"]
    .filter((level) => confidenceCounts[level])
    .map((level) => `${confidenceCounts[level]} ${level}`)
    .join(", ") || "none";

  const report = {
    url: url || "",
    apartmentName: apartmentName || "",
    extractionMethod,
    listingsFound: diagnosis.counts.candidates,
    validListings: diagnosis.counts.valid,
    duplicatesRemoved: diagnosis.counts.duplicatesRemoved,
    rejected: diagnosis.counts.rejected,
    fieldsDetected,
    confidence: confidenceLabel,
    confidenceCounts,
    problems,
    recommendedNextStep: recommendNextStep(diagnosis, classified, strategyResults, problems),
    strategies: strategyResults,
    listings: listings.map(toListingDiagnostic),
    rejectedCandidates: diagnosis.rejected,
    warnings,
    outcome: classified.outcome,
    headline: classified.headline,
    analyzedAt: new Date().toISOString(),
  };

  report.summaryText = formatSummaryText(report);
  return report;
}

function completeStrategyResults(rawResults, listings) {
  const bySource = new Map((rawResults || []).map((item) => [item.source, item]));
  for (const listing of listings) {
    for (const source of listing.sources || [listing.source]) {
      if (!source) continue;
      if (!bySource.has(source)) {
        bySource.set(source, {
          source,
          label: STRATEGY_LABELS[source] || source,
          listingCount: 0,
          confidence: 0,
          evidence: [],
          error: null,
          worked: false,
        });
      }
    }
  }

  return STRATEGY_ORDER.map((source) => {
    const item = bySource.get(source) || {
      source,
      label: STRATEGY_LABELS[source] || source,
      listingCount: 0,
      confidence: 0,
      evidence: [],
      error: null,
      worked: false,
    };
    const produced = listings.filter((listing) => (listing.sources || [listing.source]).includes(source)).length;
    const signals = (item.evidence || []).length;
    const worked =
      source === "api"
        ? signals > 0
        : Boolean(item.worked) || item.listingCount > 0 || produced > 0;
    return {
      source,
      label: STRATEGY_LABELS[source] || item.label || source,
      worked,
      listingCount: item.listingCount || 0,
      produced,
      evidence: item.evidence || [],
      error: item.error || null,
    };
  });
}

function toListingDiagnostic(listing) {
  const fields = {};
  for (const spec of CHECKLIST_FIELDS) {
    const evidence = listing.evidence?.[spec.key] || null;
    const value = listing[spec.key];
    let status = "missing";
    if (value != null && value !== "") {
      status = evidence?.ambiguous || evidence?.inferred ? "ambiguous" : "ok";
    }
    fields[spec.key] = {
      label: spec.label,
      value,
      display: formatField(spec, value),
      status,
      source: evidence?.source || listing.source || null,
      origin: evidence?.origin || null,
      method: evidence?.method || null,
      selector: evidence?.selector || null,
      snippet: evidence?.snippet || "",
    };
  }

  return {
    id: listing.id,
    unit: listing.unit,
    floorPlan: listing.floorPlan,
    source: listing.source,
    sources: listing.sources || [listing.source],
    confidence: listing.confidence,
    populated: populatedListingFields(listing).length,
    fields,
  };
}

function formatField(spec, value) {
  if (value == null || value === "") return "";
  if (spec.format === "price") return `$${Number(value).toLocaleString("en-US")}`;
  if (spec.format === "beds") return value === 0 ? "Studio" : String(value);
  if (spec.format === "url") return "found";
  if (spec.format === "date") {
    if (value === "now") return "Now";
    return String(value);
  }
  return String(value);
}

function collectProblems(diagnosis, classified, strategyResults, warnings) {
  const problems = [];
  if (warnings?.length) problems.push(...warnings);
  if (classified.outcome === "FAILED") {
    problems.push("No valid listings after normalization.");
  }
  if (diagnosis.counts.rejected) {
    problems.push(`${diagnosis.counts.rejected} candidate${diagnosis.counts.rejected === 1 ? "" : "s"} rejected.`);
  }
  if (diagnosis.counts.duplicatesRemoved) {
    problems.push(`${diagnosis.counts.duplicatesRemoved} duplicate${diagnosis.counts.duplicatesRemoved === 1 ? "" : "s"} merged.`);
  }

  const failedStrategies = strategyResults.filter((item) => item.error);
  for (const item of failedStrategies) {
    problems.push(`${item.label} threw: ${item.error}`);
  }

  const listings = diagnosis.listings || [];
  if (listings.length) {
    const missing = CHECKLIST_FIELDS.filter((field) => listings.every((listing) => listing[field.key] == null));
    if (missing.length) {
      problems.push(`Never found: ${missing.map((field) => field.label.toLowerCase()).join(", ")}.`);
    }
    const ambiguous = CHECKLIST_FIELDS.filter((field) =>
      listings.some((listing) => listing.evidence?.[field.key]?.ambiguous),
    );
    if (ambiguous.length) {
      problems.push(`Ambiguous: ${ambiguous.map((field) => field.label.toLowerCase()).join(", ")}.`);
    }
  }

  const api = strategyResults.find((item) => item.source === "api");
  if (api?.worked) {
    problems.push("Page mentions listing API URLs, but AptWatch does not call APIs yet.");
  }

  return problems;
}

function recommendNextStep(diagnosis, classified, strategyResults, problems) {
  if (classified.outcome === "SUCCESS" && diagnosis.counts.valid >= 1) {
    const serious = problems.some((line) => /threw|Never found/.test(line));
    if (!serious) return "Looks solid. No scraper change needed unless a field is wrong.";
  }
  if (classified.outcome === "FAILED") {
    const jsonLd = strategyResults.find((item) => item.source === "jsonLd");
    const json = strategyResults.find((item) => item.source === "json");
    const html = strategyResults.find((item) => item.source === "html");
    const api = strategyResults.find((item) => item.source === "api");
    if (api?.worked) {
      return "This site likely loads units from an API. Send the URL plus any /api/... paths from Diagnostics.";
    }
    if (!jsonLd?.worked && !json?.worked && !html?.worked) {
      return "No structured listings in HTML or JSON. Send the URL and say whether the live page shows unit cards after scrolling.";
    }
    return "Candidates were found but none survived normalization. Open Diagnostics and send rejected reasons.";
  }
  if (problems.some((line) => /Never found:.*availability/.test(line))) {
    return "Dates are missing. Send one raw unit card’s text (price + available line).";
  }
  if (problems.some((line) => /Never found:.*price/.test(line))) {
    return "Prices are missing. Send whether the page shows $ amounts or 'Price: 4,215' without a dollar sign.";
  }
  return "Partial extraction. Send the URL, the Diagnostics summary, and one listing that looks wrong.";
}

function formatSummaryText(report) {
  const strategyLines = report.strategies
    .map((item) => `${item.worked ? "✓" : "✗"} ${item.label}`)
    .join("\n");
  const problemLines = report.problems.length ? report.problems.map((line) => `- ${line}`).join("\n") : "- none";
  return [
    `URL: ${report.url}`,
    `Extraction method: ${report.extractionMethod}`,
    `Listings found: ${report.listingsFound}`,
    `Valid listings: ${report.validListings}`,
    `Duplicates removed: ${report.duplicatesRemoved}`,
    `Listings rejected: ${report.rejected}`,
    `Fields detected: ${report.fieldsDetected.join(", ") || "none"}`,
    `Confidence: ${report.confidence}`,
    `Problems:`,
    problemLines,
    `Recommended next step: ${report.recommendedNextStep}`,
    ``,
    `Strategies:`,
    strategyLines,
  ].join("\n");
}
