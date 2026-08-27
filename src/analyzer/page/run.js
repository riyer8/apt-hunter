AptWatchAnalyzer.run = function run() {
  const candidates = [];

  for (const [source, extract] of Object.entries(AptWatchAnalyzer.extractors)) {
    try {
      const records = extract() || [];
      for (const record of records) {
        if (record && typeof record === "object") {
          candidates.push({ source, record });
        }
      }
    } catch (error) {
      console.warn("AptWatch extractor failed:", source, error);
    }
  }

  return {
    pageUrl: location.href,
    apartmentName: pageApartmentName(),
    candidates,
  };
};

function pageApartmentName() {
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const heading = document.querySelector("h1")?.innerText;
  const title = document.title;
  const value = (og || heading || title || "").replace(/\s+/g, " ").trim();
  return value.split("|")[0].split(" - ")[0].trim();
}
