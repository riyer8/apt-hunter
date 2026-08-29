/**
 * Canonical AptWatch models.
 * Keep this in sync with extension/analyzer/listings.js createListing()
 * and extension/lib/storage.js apartment records.
 *
 * The web dashboard must consume this shape. Do not invent a parallel format.
 */

export const LISTING_FIELDS = [
  "unit",
  "price",
  "bedrooms",
  "bathrooms",
  "sqft",
  "availableDate",
  "floorPlan",
  "listingUrl",
];

export const CONFIDENCE = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

export const STATUS = {
  NOT_ANALYZED: "Not analyzed",
  ANALYZING: "Analyzing…",
  SUCCESS: "Availability detected",
  PARTIAL: "Partial detection",
  FAILED: "Could not detect",
};

/** @typedef {typeof CONFIDENCE[keyof typeof CONFIDENCE]} Confidence */
/** @typedef {typeof STATUS[keyof typeof STATUS]} ApartmentStatus */

/**
 * @typedef {object} Listing
 * @property {string | null} id
 * @property {string | null} apartmentName
 * @property {string | null} unit
 * @property {number | null} price
 * @property {number | null} bedrooms
 * @property {number | null} bathrooms
 * @property {number | null} sqft
 * @property {string | null} availableDate
 * @property {string | null} floorPlan
 * @property {string | null} listingUrl
 * @property {string | null} sourceUrl
 * @property {string | null} firstSeen
 * @property {string | null} lastSeen
 * @property {Confidence} confidence
 * @property {string | null} source
 * @property {string[]} [sources]
 * @property {Record<string, unknown>} [evidence]
 * @property {number | null} [previousPrice] Dashboard-only until Step 5 has price history
 */

/**
 * @typedef {object} Apartment
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string | null} location
 * @property {string} dateAdded
 * @property {ApartmentStatus} status
 * @property {string | null} lastChecked
 * @property {Listing[]} listings
 * @property {object | null} [analysis]
 */

export function createListing() {
  return {
    id: null,
    apartmentName: null,
    unit: null,
    price: null,
    bedrooms: null,
    bathrooms: null,
    sqft: null,
    availableDate: null,
    floorPlan: null,
    listingUrl: null,
    sourceUrl: null,
    firstSeen: null,
    lastSeen: null,
    confidence: CONFIDENCE.LOW,
    source: null,
    sources: [],
    evidence: {},
    previousPrice: null,
  };
}

export function createApartment() {
  return {
    id: null,
    name: "",
    url: "",
    location: null,
    dateAdded: null,
    status: STATUS.NOT_ANALYZED,
    lastChecked: null,
    listings: [],
    analysis: null,
  };
}
