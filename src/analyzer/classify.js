import {
  applyPreviousSightings,
  candidateToListing,
  dedupeListings,
  populatedListingFields,
  sortListings,
} from "./listings.js";

export const OUTCOME = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
};

const FIELD_LABELS = {
  unit: "unit",
  price: "price",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  sqft: "sqft",
  availableDate: "availability date",
  floorPlan: "floor plan",
  listingUrl: "listing URL",
};

export function buildListings(candidates, context) {
  const listings = [];
  for (const candidate of candidates || []) {
    const listing = candidateToListing(candidate, context);
    if (listing) listings.push(listing);
  }
  return sortListings(applyPreviousSightings(dedupeListings(listings), context.previousListings));
}

export function classify(listings) {
  const valid = listings || [];
  if (valid.length === 0) {
    return {
      outcome: OUTCOME.FAILED,
      headline: "✕ Could not reliably detect apartment availability",
      details: [],
      listingCount: 0,
      fieldsDetected: [],
      strategies: [],
      listings: [],
    };
  }

  const fieldsDetected = Object.keys(FIELD_LABELS).filter((field) =>
    valid.some((listing) => listing[field] != null),
  );
  const strategies = [...new Set(valid.map((listing) => listing.source).filter(Boolean))];
  const strong = valid.filter((listing) => populatedListingFields(listing).length >= 3);
  const hasIdentity = valid.some((listing) => listing.unit || listing.floorPlan);
  const hasPriceOrDate = valid.some((listing) => listing.price != null || listing.availableDate);

  const success = strong.length >= 1 && hasIdentity && hasPriceOrDate && fieldsDetected.length >= 3;
  const fieldLabels = fieldsDetected.map((field) => FIELD_LABELS[field]);

  if (success) {
    return {
      outcome: OUTCOME.SUCCESS,
      headline: "✓ Availability detected",
      details: [
        `${valid.length} ${valid.length === 1 ? "listing" : "listings"} found`,
      ],
      listingCount: valid.length,
      fieldsDetected: fieldLabels,
      strategies,
      listings: valid,
    };
  }

  return {
    outcome: OUTCOME.PARTIAL,
    headline: "⚠ Availability detected, but some fields are missing",
    details: [`${valid.length} ${valid.length === 1 ? "listing" : "listings"} found`],
    listingCount: valid.length,
    fieldsDetected: fieldLabels,
    strategies,
    listings: valid,
  };
}
