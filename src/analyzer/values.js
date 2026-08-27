const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function emptyToNull(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

export function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/usd/i, "").trim();
  if (/call|request|ask for|n\/?a|tbd|contact/i.test(cleaned) && !/\$\s*\d/.test(cleaned) && !/price\s*:/i.test(cleaned)) {
    return null;
  }

  const labeled = cleaned.match(/(?:price|rent|starting at|from)\s*:?\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  const dollar = cleaned.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  const range = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(?:-|–|to)\s*\$?\s*[\d,]+/i);
  const plainNumber = /^[\d,]+(?:\.\d+)?$/.test(cleaned) ? cleaned.match(/([\d,]+(?:\.\d+)?)/) : null;
  const match = labeled || dollar || range || plainNumber;
  if (!match) return null;

  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 100 || amount > 100000) return null;
  return Math.round(amount);
}

export function parseSqft(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 150 && value <= 20000) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const labeled = /sq\.?\s*ft|sqft|\bsf\b|square feet/i.test(value);
  const plain = /^[\d,]+$/.test(value.trim());
  if (!labeled && !plain) return null;
  const match = value.replace(/,/g, "").match(/(\d{3,5})/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (amount < 150 || amount > 20000) return null;
  return amount;
}

export function parseBedrooms(value) {
  if (typeof value === "boolean") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0 || value > 12) return null;
    return value;
  }
  if (typeof value !== "string") return null;
  if (/studio/i.test(value) && !/\d+\s*(?:bed|bd|br)/i.test(value)) return 0;
  const labeled = value.match(/\b(studio|\d+)\s*(?:bed|bd|br|bedroom)s?\b/i);
  if (labeled) {
    return labeled[1].toLowerCase() === "studio" ? 0 : Number(labeled[1]);
  }
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  if (!Number.isFinite(amount) || amount < 0 || amount > 12) return null;
  return amount;
}

export function parseBathrooms(value) {
  if (typeof value === "boolean") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0 || value > 12) return null;
    return value;
  }
  if (typeof value !== "string") return null;
  const labeled = value.match(/\b(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)s?\b/i);
  if (labeled) {
    const amount = Number(labeled[1]);
    if (!Number.isFinite(amount) || amount < 0 || amount > 12) return null;
    return amount;
  }
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  if (!Number.isFinite(amount) || amount < 0 || amount > 12) return null;
  return amount;
}

export function parseBedsBaths(text) {
  if (typeof text !== "string") return { bedrooms: null, bathrooms: null };
  const normalized = text.replace(/(\d+)\s*bed(?:room)?s?\s*(\d+(?:\.\d+)?)\s*bath/gi, "$1 bed $2 bath");
  const bedrooms = parseBedrooms(normalized);
  const bathrooms = parseBathrooms(normalized);
  return {
    bedrooms: bedrooms == null || Number.isNaN(bedrooms) ? null : bedrooms,
    bathrooms: bathrooms == null || Number.isNaN(bathrooms) ? null : bathrooms,
  };
}

export function parseDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (value > 1e12) return toIsoDate(new Date(value));
    if (value > 1e9) return toIsoDate(new Date(value * 1000));
    return null;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text || /^(false|true|null|undefined|availability|date|available)$/i.test(text)) {
    return null;
  }
  if (/waitlist|sold out|unavailable/i.test(text) && !/\d/.test(text)) return null;
  if (/now|immediately|today/i.test(text)) return "now";

  const mdOnly = text.match(/\bavailable:?\s*(\d{1,2})\/(\d{1,2})(?!\/\d)/i);
  if (mdOnly) {
    const month = Number(mdOnly[1]);
    const day = Number(mdOnly[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (us) {
    let month = Number(us[1]);
    let day = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) [month, day] = [day, month];
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
      return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const named = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i,
  );
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    const day = Number(named[2]);
    if (!month || day < 1 || day > 31) return null;
    if (!named[3]) {
      const label = named[1].slice(0, 1).toUpperCase() + named[1].slice(1, 3).toLowerCase();
      return `${label} ${day}`;
    }
    const year = Number(named[3]);
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

export function parseUnit(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^(unit|apt|apartment|rent|price|availability|floor plan|studio)$/i.test(text)) return null;
  if (/apartments?|community|residences|complex|property/i.test(text) && !/\d/.test(text)) {
    return null;
  }

  const labeled = text.match(/\b(?:unit|apt\.?|#)\s*([A-Z0-9-]{1,12})\b/i);
  if (labeled) return labeled[1].toUpperCase();

  if (isUnitCode(text, { allowPlainNumber: true })) return text.toUpperCase();

  const firstToken = text.split(/[\s•|,/]+/)[0];
  if (firstToken && firstToken !== text && isUnitCode(firstToken, { allowPlainNumber: false })) {
    return firstToken.toUpperCase();
  }

  return null;
}

function isUnitCode(value, { allowPlainNumber = false } = {}) {
  if (!value || value.length > 16) return false;
  if (/^(19|20)\d{2}$/.test(value)) return false;
  if (/^\d+$/.test(value)) return Boolean(allowPlainNumber && value.length >= 2 && value.length <= 6);
  return /^(?:[A-Z]{1,3}-)?\d+[A-Z0-9]*(?:-[A-Z0-9]{1,8})?$/i.test(value);
}

export function parseFloorPlan(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/^(floor\s*plan|plan|layout|model)$/i.test(text)) return null;
  if (/apartments?|community|residences|available/i.test(text) && text.length > 40) return null;

  const named = text.match(
    /\b((?:corner\s+)?(?:alcove\s+)?studio|(?:corner\s+)?\d+\s+bed(?:room)?s?)\b/i,
  );
  if (named) return titleCase(named[1]);

  const labeled = text.match(/\b(?:plan|floor\s*plan|model)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 _-]{0,24})\b/i);
  if (labeled) return labeled[1].trim();
  if (/^[A-Z0-9][A-Z0-9 _-]{0,32}$/i.test(text)) return text;
  if (text.length <= 40 && !/price|available|view unit/i.test(text)) return text;
  return null;
}

function titleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parseUrl(value, pageUrl) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^(javascript:|#|mailto:|tel:)/i.test(value)) return null;
  try {
    return new URL(value, pageUrl || undefined).toString();
  } catch {
    return null;
  }
}

export function parseApartmentName(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 80) return null;
  if (/^(home|availability|apartments|floor plans|welcome)$/i.test(text)) return null;
  return text.split("|")[0].split(" - ")[0].trim() || null;
}

function toIsoDate(date) {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function extractFactsFromText(text) {
  if (typeof text !== "string" || !text.trim()) {
    return {
      unit: null,
      price: null,
      bedrooms: null,
      bathrooms: null,
      sqft: null,
      availableDate: null,
      floorPlan: null,
    };
  }

  const compact = text.replace(/\s+/g, " ").trim();
  const bedsBaths = parseBedsBaths(compact);
  const beforePrice = compact.split(/price\s*:|starting at/i)[0];
  return {
    unit: parseUnit(compact),
    price: parsePrice(compact),
    bedrooms: bedsBaths.bedrooms,
    bathrooms: bedsBaths.bathrooms,
    sqft: parseSqft(compact),
    availableDate: parseDate(compact),
    floorPlan: parseFloorPlan(beforePrice) || parseFloorPlan(compact),
  };
}
