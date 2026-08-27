import { listingMatchesFilters, listingSearchText } from "@shared/listingView.js";

export const EMPTY_FILTERS = {
  query: "",
  maxRent: "",
  minSqft: "",
  maxSqft: "",
  bedrooms: "",
  bathrooms: "",
  availableBy: "",
  newOnly: false,
  priceDropsOnly: false,
  sort: "unit",
  sortDir: "",
};

export function hasListingFilters(filters) {
  return Boolean(
    filters.maxRent ||
      filters.minSqft ||
      filters.maxSqft ||
      filters.bedrooms !== "" ||
      filters.bathrooms !== "" ||
      filters.availableBy ||
      filters.newOnly ||
      filters.priceDropsOnly,
  );
}

export function matchingListings(apartment, filters) {
  const listingFilters = { ...filters, query: "" };
  return (apartment.listings || []).filter((listing) => listingMatchesFilters(listing, listingFilters));
}

export function apartmentVisible(apartment, filters) {
  const listings = matchingListings(apartment, filters);
  const query = filters.query.trim().toLowerCase();

  if (query) {
    const inBuilding = `${apartment.name} ${apartment.location || ""}`.toLowerCase().includes(query);
    const inUnits = listings.some((listing) => listingSearchText(listing).includes(query));
    if (!inBuilding && !inUnits) return false;
  }

  if (hasListingFilters(filters) && listings.length === 0) return false;
  return true;
}
