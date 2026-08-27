AptWatchAnalyzer.register("jsData", function extractJsData() {
  const node = document.getElementById("aptwatch-page-state");
  if (!node) return [];

  let buckets;
  try {
    buckets = JSON.parse(node.textContent || "[]");
  } catch {
    return [];
  }

  if (!Array.isArray(buckets)) buckets = [buckets];

  const records = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      records.push(
        ...bucket.filter((item) => item && typeof item === "object" && AptWatchAnalyzer.isUnitLike(item)).map((item) => {
          item._method = item._method || "page-state";
          return item;
        }),
      );
      continue;
    }
    if (bucket && typeof bucket === "object" && AptWatchAnalyzer.isUnitLike(bucket)) {
      bucket._method = bucket._method || "page-state";
      records.push(bucket);
    }
  }
  return records;
});
