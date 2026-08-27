AptWatchAnalyzer.register("json", function extractJson() {
  return [...extractJsonLd(), ...extractEmbeddedJson()];
});

function extractJsonLd() {
  const records = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent || "null");
    } catch {
      continue;
    }
    collectFromLd(parsed, records);
  }

  return records;
}

function collectFromLd(node, records, depth) {
  if (node == null || depth > 8) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectFromLd(item, records, (depth || 0) + 1));
    return;
  }
  if (typeof node !== "object") return;

  const type = [].concat(node["@type"] || []).map((value) => String(value).toLowerCase());
  if (type.some((value) => /apartmentcomplex|organization|webpage|breadcrumblist|realestateagent/i.test(value))) {
    if (node["@graph"]) collectFromLd(node["@graph"], records, (depth || 0) + 1);
    if (node.containsPlace) collectFromLd(node.containsPlace, records, (depth || 0) + 1);
    return;
  }

  const interesting = type.some((value) =>
    /apartment|residence|accommodation|offer|product|floorplan|realestate|rental|lodging/i.test(value),
  );

  if (interesting && (node.unitNumber || node.sku || node.offers || node.numberOfBedrooms || node.floorSize)) {
    records.push(flattenLdNode(node));
  }

  if (node["@graph"]) collectFromLd(node["@graph"], records, (depth || 0) + 1);
  if (node.offers) collectFromLd(node.offers, records, (depth || 0) + 1);
  if (node.containsPlace) collectFromLd(node.containsPlace, records, (depth || 0) + 1);
  if (node.hasOfferCatalog) collectFromLd(node.hasOfferCatalog, records, (depth || 0) + 1);
}

function flattenLdNode(node) {
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const floorSize = node.floorSize;
  return {
    unit: node.unitNumber || node.identifier || node.sku,
    floorPlan: typeof node.floorPlan === "string" ? node.floorPlan : node.name,
    price: offer?.price || offer?.lowPrice || node.price,
    bedrooms: node.numberOfBedrooms || node.numberOfRooms || node.bedrooms,
    bathrooms: node.numberOfBathroomsTotal || node.numberOfBathrooms || node.bathrooms,
    sqft: typeof floorSize === "object" ? floorSize?.value : floorSize || node.squareFootage,
    availableDate: offer?.availabilityStarts || node.availabilityStarts || node.temporalCoverage,
    url: offer?.url || node.url,
  };
}

function extractEmbeddedJson() {
  const records = [];
  const scripts = document.querySelectorAll("script");

  for (const script of scripts) {
    if (script.id === "aptwatch-page-state") continue;
    const type = (script.type || "").toLowerCase();
    if (type.includes("ld+json")) continue;

    const text = script.textContent || "";
    if (text.length < 20 || text.length > 1_500_000) continue;

    for (const parsed of parseJsonBlobs(text)) {
      collectUnitRecords(parsed, records, 0, new WeakSet());
    }
  }

  return records;
}

function parseJsonBlobs(text) {
  const blobs = [];
  const assignment = text.match(
    /(?:window\.)?(?:__NEXT_DATA__|__NUXT__|__INITIAL_STATE__|__PRELOADED_STATE__|__APOLLO_STATE__)\s*=\s*(\{[\s\S]*\})\s*;?/,
  );
  if (assignment) pushParsed(assignment[1], blobs);
  if (/^\s*[{[]/.test(text)) pushParsed(text, blobs);
  return blobs;
}

function pushParsed(value, blobs) {
  if (typeof value !== "string") {
    if (value && typeof value === "object") blobs.push(value);
    return;
  }
  try {
    blobs.push(JSON.parse(value));
  } catch {
    /* ignore invalid json */
  }
}

function collectUnitRecords(value, records, depth, visited) {
  if (value == null || depth > 8) return;
  if (typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    if (value.length && value.every((item) => !item || typeof item !== "object")) return;
    const unitLike = value.filter((item) => AptWatchAnalyzer.isUnitLike(item));
    if (unitLike.length >= 1 && unitLike.length / Math.min(value.length, 25) >= 0.35) {
      records.push(...unitLike);
      return;
    }
    const limit = Math.min(value.length, 120);
    for (let i = 0; i < limit; i += 1) collectUnitRecords(value[i], records, depth + 1, visited);
    return;
  }

  if (AptWatchAnalyzer.isUnitLike(value)) records.push(value);

  for (const [key, child] of Object.entries(value)) {
    if (AptWatchAnalyzer.UNIT_ARRAY_KEYS.has(AptWatchAnalyzer.normKey(key)) && Array.isArray(child)) {
      collectUnitRecords(child, records, depth + 1, visited);
      continue;
    }
    collectUnitRecords(child, records, depth + 1, visited);
  }
}
