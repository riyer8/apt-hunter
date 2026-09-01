import { CHANGE_EVENT_TYPES, countChangesByType, filterRecentChanges } from "@shared/changeListings.js";

export { CHANGE_EVENT_TYPES, countChangesByType, filterRecentChanges };

export function listingLookup(apartments) {
  const map = new Map();
  for (const apartment of apartments || []) {
    for (const listing of apartment.listings || []) {
      map.set(listing.id, {
        ...listing,
        apartmentId: apartment.id,
        apartmentName: listing.apartmentName || apartment.name,
        buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
      });
    }
  }
  return map;
}

export function listingForChange(change, lookup) {
  const listing = lookup.get(change.listingId);
  if (listing) return applyChangeToListing(listing, change);
  return listingFromChange(change);
}

function listingFromChange(change) {
  const details = change.details || {};
  const previousValue = numericOrNull(change.previousValue);
  const newValue = numericOrNull(change.newValue);

  return {
    id: change.listingId,
    apartmentId: change.apartmentId,
    apartmentName: change.apartmentName,
    unit: change.unit,
    listingUrl: change.listingUrl,
    price: details.currentPrice ?? newValue,
    previousPrice: details.previousPrice ?? previousValue,
    availableDate: details.currentAvailability ?? null,
    isActive: change.changeType !== "REMOVED",
    match: null,
  };
}

function applyChangeToListing(listing, change) {
  const details = change.details || {};
  const previousValue = numericOrNull(change.previousValue);
  const newValue = numericOrNull(change.newValue);
  const next = { ...listing };

  if (change.changeType === "PRICE_DROP" || change.changeType === "PRICE_INCREASE") {
    next.price = details.currentPrice ?? newValue ?? next.price;
    next.previousPrice = details.previousPrice ?? previousValue ?? next.previousPrice;
  }

  if (change.changeType === "AVAILABILITY_CHANGED") {
    next.availableDate = details.currentAvailability ?? change.newValue ?? next.availableDate;
  }

  if (change.changeType === "REMOVED") {
    next.isActive = false;
  }

  return next;
}

function numericOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
