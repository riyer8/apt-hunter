var AptWatchAnalyzer = globalThis.AptWatchAnalyzer || {};
AptWatchAnalyzer.extractors = AptWatchAnalyzer.extractors || {};

AptWatchAnalyzer.STRATEGY_LABELS = {
  jsonLd: "JSON-LD",
  json: "Embedded JSON",
  jsData: "Page JS state",
  html: "Static HTML",
  text: "DOM extraction",
  api: "API detection",
};

AptWatchAnalyzer.normalizeStrategyResult = function normalizeStrategyResult(name, result) {
  if (result && Array.isArray(result.listings)) {
    return {
      listings: result.listings.filter((item) => item && typeof item === "object"),
      source: result.source || name,
      confidence: typeof result.confidence === "number" ? result.confidence : result.listings.length ? 0.5 : 0,
      evidence: Array.isArray(result.evidence) ? result.evidence : [],
      error: result.error || null,
    };
  }

  const listings = Array.isArray(result) ? result.filter((item) => item && typeof item === "object") : [];
  return {
    listings,
    source: name,
    confidence: listings.length ? 0.5 : 0,
    evidence: [],
    error: null,
  };
};

AptWatchAnalyzer.register = function register(name, run) {
  AptWatchAnalyzer.extractors[name] = function wrappedExtract() {
    return AptWatchAnalyzer.normalizeStrategyResult(name, run());
  };
};

globalThis.AptWatchAnalyzer = AptWatchAnalyzer;
