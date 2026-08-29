AptWatchAnalyzer.register("jsonLd", function extractJsonLdStrategy() {
  return extractJsonLd();
});

AptWatchAnalyzer.register("json", function extractEmbeddedJsonStrategy() {
  return extractEmbeddedJson();
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
  const isShell = type.some((value) =>
    /apartmentcomplex|organization|webpage|breadcrumblist|realestateagent|aggregateoffer|realestatelisting/i.test(
      value,
    ),
  );
  const isOffer = type.includes("offer") && !type.includes("aggregateoffer");
  const isUnitType = type.some((value) =>
    /(^apartment$|residence|accommodation|floorplan|^lodging)/i.test(value),
  );

  if (!isShell) {
    if (isUnitType && (node.unitNumber || node.name || node.numberOfBedrooms != null || node.floorSize)) {
      records.push(flattenLdNode(node));
    } else if (
      isOffer &&
      (node.name || node.unitNumber) &&
      (node.price != null || node.lowPrice != null || node.availabilityStarts)
    ) {
      records.push(flattenLdNode(node));
    }
  }

  collectFromLd(node["@graph"], records, (depth || 0) + 1);
  collectFromLd(node.about, records, (depth || 0) + 1);
  collectFromLd(node.offers, records, (depth || 0) + 1);
  collectFromLd(node.containsPlace, records, (depth || 0) + 1);
  collectFromLd(node.hasOfferCatalog, records, (depth || 0) + 1);
  collectFromLd(node.itemOffered, records, (depth || 0) + 1);
}

function flattenLdNode(node) {
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const usableOffer =
    offer && typeof offer === "object" && !/aggregate/i.test(String(offer["@type"] || "")) ? offer : null;
  const floorSize = node.floorSize;
  const name = typeof node.name === "string" ? node.name : null;
  return {
    unit: node.unitNumber || node.identifier || node.sku || name,
    floorPlan: typeof node.floorPlan === "string" ? node.floorPlan : null,
    price: node.price || node.lowPrice || usableOffer?.price || usableOffer?.lowPrice,
    bedrooms: node.numberOfBedrooms ?? node.numberOfRooms ?? node.bedrooms,
    bathrooms: node.numberOfBathroomsTotal ?? node.numberOfBathrooms ?? node.bathrooms,
    sqft: typeof floorSize === "object" ? floorSize?.value : floorSize || node.squareFootage,
    availableDate: node.availabilityStarts || usableOffer?.availabilityStarts || node.temporalCoverage,
    url: usableOffer?.url || node.url || null,
    _method: "json-ld",
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
  const names = [
    "__NEXT_DATA__",
    "__NUXT__",
    "__INITIAL_STATE__",
    "__PRELOADED_STATE__",
    "__APOLLO_STATE__",
    "Fusion.globalContent",
    "globalContent",
  ];

  const seenStarts = new Set();
  for (const name of names) {
    const pattern = new RegExp(`(?:window\\.)?${name.replace(".", "\\.")}\\s*=\\s*(\\{)`);
    const match = text.match(pattern);
    if (!match) continue;
    const start = match.index + match[0].length - 1;
    if (seenStarts.has(start)) continue;
    seenStarts.add(start);
    const json = sliceBalanced(text, start);
    if (json) pushParsed(json, blobs);
  }

  if (/^\s*[{[]/.test(text)) pushParsed(text, blobs);
  return blobs;
}

function sliceBalanced(text, start) {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  if (open !== "{" && open !== "[") return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  const limit = Math.min(text.length, start + 1_500_000);

  for (let i = start; i < limit; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stampEmbedded(item) {
  if (!item || typeof item !== "object") return item;
  if (item._method) return item;
  item._method = "embedded-json";
  return item;
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
      records.push(...unitLike.map((item) => stampEmbedded(item)));
      return;
    }
    const limit = Math.min(value.length, 120);
    for (let i = 0; i < limit; i += 1) collectUnitRecords(value[i], records, depth + 1, visited);
    return;
  }

  if (AptWatchAnalyzer.isUnitLike(value)) records.push(stampEmbedded(value));

  for (const [key, child] of Object.entries(value)) {
    if (AptWatchAnalyzer.UNIT_ARRAY_KEYS.has(AptWatchAnalyzer.normKey(key)) && Array.isArray(child)) {
      collectUnitRecords(child, records, depth + 1, visited);
      continue;
    }
    collectUnitRecords(child, records, depth + 1, visited);
  }
}
