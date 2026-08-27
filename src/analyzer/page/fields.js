var AptWatchAnalyzer = globalThis.AptWatchAnalyzer || {};

AptWatchAnalyzer.FIELD_ALIASES = {
  unit: [
    "unit",
    "unitnumber",
    "unitno",
    "unitid",
    "unitname",
    "apartmentnumber",
    "apartmentno",
    "aptnumber",
    "aptno",
    "apt",
    "number",
    "unitcode",
    "suitenumber",
  ],
  floorPlan: [
    "floorplan",
    "floorplanname",
    "floorplanid",
    "planname",
    "plan",
    "layout",
    "layoutname",
    "name",
    "modelname",
    "model",
  ],
  price: [
    "price",
    "rent",
    "rental",
    "monthlyrent",
    "minrent",
    "maxrent",
    "minprice",
    "maxprice",
    "pricefrom",
    "startingat",
    "startingprice",
    "amount",
    "baseprice",
    "advertisedrent",
    "grossrent",
  ],
  bedrooms: [
    "bedrooms",
    "bedroom",
    "beds",
    "bed",
    "beds",
    "numberofbedrooms",
    "numberofrooms",
    "bedroomcount",
    "nbeds",
    "br",
    "studio",
  ],
  bathrooms: [
    "bathrooms",
    "bathroom",
    "baths",
    "bath",
    "numberofbathroomstotal",
    "numberofbathrooms",
    "bathroomcount",
    "nbaths",
    "ba",
  ],
  sqft: [
    "sqft",
    "sqfeet",
    "squarefeet",
    "squarefootage",
    "area",
    "size",
    "sqftmin",
    "minsqft",
    "maxsqft",
    "floorsize",
    "livingarea",
    "interiorsize",
  ],
  availableDate: [
    "availabledate",
    "availableon",
    "available",
    "availability",
    "availabilitydate",
    "dateavailable",
    "availablefrom",
    "vacantdate",
    "moveindate",
    "availabletext",
    "datavailable",
  ],
  url: [
    "url",
    "href",
    "link",
    "applyurl",
    "listingurl",
    "canonicalurl",
    "detailurl",
    "uniturl",
    "permalink",
  ],
};

AptWatchAnalyzer.UNIT_ARRAY_KEYS = new Set([
  "units",
  "availableunits",
  "unitlist",
  "unitlistings",
  "apartments",
  "apartmentunits",
  "listings",
  "floorplans",
  "floorplanlist",
  "availability",
  "availabilitylist",
  "vacancies",
  "vacantunits",
  "homes",
  "residences",
  "spaces",
]);

AptWatchAnalyzer.normKey = function normKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
};

AptWatchAnalyzer.fieldForKey = function fieldForKey(key) {
  const normalized = AptWatchAnalyzer.normKey(key);
  for (const [field, aliases] of Object.entries(AptWatchAnalyzer.FIELD_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
};

AptWatchAnalyzer.matchedFields = function matchedFields(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const fields = new Set();
  for (const key of Object.keys(obj)) {
    const field = AptWatchAnalyzer.fieldForKey(key);
    if (field) fields.add(field);
  }
  return [...fields];
};

AptWatchAnalyzer.isUnitLike = function isUnitLike(obj) {
  const fields = AptWatchAnalyzer.matchedFields(obj);
  if (fields.length < 2) return false;

  const identity = fields.includes("unit") || fields.includes("floorPlan") || fields.includes("url");
  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].filter((field) =>
    fields.includes(field),
  );
  return (identity && facts.length >= 1) || facts.length >= 2;
};

AptWatchAnalyzer.recordFromVisibleText = function recordFromVisibleText(text) {
  const compact = (text || "").replace(/\s+/g, " ").trim();
  const record = { text: compact };

  const unitMatch = compact.match(/\b(?:unit|apt\.?|#)\s*([A-Z0-9-]{1,12})\b/i);
  if (unitMatch) record.unit = unitMatch[1];
  if (!record.unit) {
    const first = compact.split(/[\s•|,]+/)[0];
    const rest = compact.slice(first.length);
    const mixed = first && /[A-Z-]/i.test(first) && /\d/.test(first) && first.length <= 16;
    if (mixed && rest.length > 0 && /^(?:[A-Z]{1,3}-)?\d+[A-Z0-9]*(?:-[A-Z0-9]{1,8})?$/i.test(first)) {
      record.unit = first;
    }
  }

  const priceMatch =
    compact.match(/\$\s*([\d,]+(?:\.\d+)?)/) ||
    compact.match(/(?:price|starting at|from)\s*:?\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  if (priceMatch) record.price = priceMatch[0];

  const bedMatch = compact.match(/\b(studio|\d+)\s*(?:bed|bd|br|bedroom)s?\b/i);
  if (bedMatch) record.bedrooms = bedMatch[1];

  const bathMatch = compact.match(/\b(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)s?\b/i);
  if (bathMatch) record.bathrooms = bathMatch[1];

  const sqftMatch = compact.match(/\b([\d,]+)\s*(?:sq\.?\s*ft|sqft|sf)\b/i);
  if (sqftMatch) record.sqft = sqftMatch[1];

  const dateMatch = compact.match(
    /\bavailable:?\s*(?:starting\s+)?(now|immediately|[A-Z][a-z]+\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
  );
  if (dateMatch) record.availableDate = dateMatch[0];

  const planMatch = compact.match(
    /\b((?:corner\s+)?(?:alcove\s+)?studio|(?:corner\s+)?\d+\s+bed(?:room)?s?)\b/i,
  );
  if (planMatch) record.floorPlan = planMatch[1];

  return record;
};

globalThis.AptWatchAnalyzer = AptWatchAnalyzer;
