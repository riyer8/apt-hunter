AptWatchAnalyzer.register("api", function detectListingApis() {
  const evidence = [];
  const srcs = [...document.querySelectorAll("script[src], link[href], a[href]")]
    .map((node) => node.src || node.href || "")
    .filter(Boolean);

  const scriptText = [...document.querySelectorAll("script")]
    .map((script) => script.textContent || "")
    .join("\n")
    .slice(0, 400000);

  const haystack = `${srcs.join("\n")}\n${scriptText}`;
  const patterns = [
    /https?:\/\/[^"' \n]+\/api\/[^"' \n]*(?:unit|availab|listing|floorplan|apartment)[^"' \n]*/gi,
    /\/(?:wp-json|api|graphql)\/[^"' \n]*(?:unit|availab|listing|floorplan)[^"' \n]*/gi,
  ];

  const seen = new Set();
  for (const pattern of patterns) {
    const matches = haystack.match(pattern) || [];
    for (const match of matches) {
      const cleaned = match.replace(/[)"']+$/, "").slice(0, 180);
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      evidence.push(cleaned);
      if (evidence.length >= 6) break;
    }
    if (evidence.length >= 6) break;
  }

  return {
    listings: [],
    source: "api",
    confidence: 0,
    evidence,
  };
});
