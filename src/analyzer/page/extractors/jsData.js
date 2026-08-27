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
      records.push(...bucket.filter((item) => item && typeof item === "object"));
      continue;
    }
    if (bucket && typeof bucket === "object") records.push(bucket);
  }
  return records;
});
