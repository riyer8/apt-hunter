import { isNewListing, isPriceDrop, isRecentlyChanged } from "@shared/listingView.js";
import { parseIsoTime } from "./format.js";

export function isChangeListing(listing) {
  return isRecentlyChanged(listing) || listing?.isActive === false;
}

export function listingMatchesChangeType(listing, type) {
  if (!type) return true;
  switch (type) {
    case "NEW":
      return isNewListing(listing);
    case "PRICE_DROP":
      return isPriceDrop(listing);
    case "PRICE_INCREASE":
      return (
        listing?.previousPrice != null &&
        listing?.price != null &&
        listing.price > listing.previousPrice
      );
    case "AVAILABILITY_CHANGED":
      return (
        isRecentlyChanged(listing) &&
        listing?.isActive !== false &&
        !isNewListing(listing) &&
        !isPriceDrop(listing) &&
        !(listing?.previousPrice != null && listing?.price != null && listing.price > listing.previousPrice)
      );
    case "REMOVED":
      return listing?.isActive === false;
    default:
      return true;
  }
}

export function sortByRecentChange(listings) {
  return [...listings].sort(
    (left, right) => (parseIsoTime(right.lastSeen) ?? 0) - (parseIsoTime(left.lastSeen) ?? 0),
  );
}

export function flattenApartmentListings(apartments) {
  return apartments.flatMap((apartment) =>
    (apartment.listings || []).map((listing) => ({
      ...listing,
      apartmentId: apartment.id,
      apartmentName: listing.apartmentName || apartment.name,
      buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
    })),
  );
}
