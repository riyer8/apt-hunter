AptWatchAnalyzer.run = function run() {
  const candidates = [];
  const strategyResults = [];

  for (const [source, extract] of Object.entries(AptWatchAnalyzer.extractors)) {
    let result;
    try {
      result = extract() || AptWatchAnalyzer.normalizeStrategyResult(source, []);
    } catch (error) {
      console.warn("AptWatch extractor failed:", source, error);
      result = {
        listings: [],
        source,
        confidence: 0,
        evidence: [],
        error: error && error.message ? error.message : String(error),
      };
    }

    strategyResults.push({
      source: result.source || source,
      label: (AptWatchAnalyzer.STRATEGY_LABELS || {})[result.source || source] || source,
      listingCount: result.listings.length,
      confidence: result.confidence,
      evidence: (result.evidence || []).slice(0, 8),
      error: result.error || null,
      worked: result.listings.length > 0 && !result.error,
    });

    for (const record of result.listings) {
      candidates.push({ source: result.source || source, record });
    }
  }

  return {
    pageUrl: location.href,
    apartmentName: pageApartmentName(),
    candidates,
    strategyResults,
  };
};

function pageApartmentName() {
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const heading = document.querySelector("h1")?.innerText;
  const title = document.title;
  const value = (og || heading || title || "").replace(/\s+/g, " ").trim();
  return value.split("|")[0].split(" - ")[0].trim();
}
