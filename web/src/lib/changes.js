import { isNewListing, isPriceDrop } from "@shared/listingView.js";
import { formatAvailableShort, formatPriceShort } from "./format.js";

export const CHANGE_META = {
  NEW: { label: "New", className: "change-new" },
  PRICE_DROP: { label: "Price drop", className: "change-drop" },
  PRICE_INCREASE: { label: "Price increase", className: "change-up" },
  AVAILABILITY_CHANGED: { label: "Availability changed", className: "change-date" },
  REMOVED: { label: "Removed", className: "change-removed" },
};

export const CHANGE_TYPES = Object.keys(CHANGE_META);

export function changeMeta(type) {
  return CHANGE_META[type] || { label: type || "Change", className: "" };
}

export function emptyChangeSummary() {
  return { new: 0, priceDrops: 0, availabilityChanged: 0, removed: 0 };
}

export function apartmentChangeSummary(apartment) {
  if (apartment?.changeSummary) return apartment.changeSummary;
  const listings = apartment?.listings || [];
  return {
    new: listings.filter((listing) => isNewListing(listing)).length,
    priceDrops: listings.filter((listing) => isPriceDrop(listing)).length,
    availabilityChanged: 0,
    removed: listings.filter((listing) => listing.isActive === false).length,
  };
}

export function formatChangeValues(change) {
  if (change.changeType === "PRICE_DROP" || change.changeType === "PRICE_INCREASE") {
    const details = change.details || {};
    const previous = formatPriceShort(details.previousPrice ?? change.previousValue);
    const current = formatPriceShort(details.currentPrice ?? change.newValue);
    const amount = details.priceChange;
    const percent = details.priceChangePercent;
    const extras = [];
    if (amount != null) {
      const abs = formatPriceShort(Math.abs(amount));
      extras.push(amount > 0 ? `+${abs}` : amount < 0 ? `-${abs}` : abs);
    }
    if (percent != null) extras.push(`${percent > 0 ? "+" : ""}${percent}%`);
    return extras.length ? `${previous} → ${current} (${extras.join(", ")})` : `${previous} → ${current}`;
  }

  if (change.changeType === "AVAILABILITY_CHANGED") {
    return `${formatAvailableShort(change.previousValue)} → ${formatAvailableShort(change.newValue)}`;
  }

  if (change.changeType === "NEW") {
    return change.unit ? `Unit ${change.unit} appeared` : "New listing appeared";
  }

  if (change.changeType === "REMOVED") {
    return change.unit ? `Unit ${change.unit} no longer listed` : "Listing no longer listed";
  }

  if (change.previousValue || change.newValue) {
    return `${change.previousValue || "—"} → ${change.newValue || "—"}`;
  }
  return "Changed";
}

export function synthesizeChanges(apartments, { apartmentId, type } = {}) {
  const events = [];
  for (const apartment of apartments || []) {
    if (apartmentId && apartment.id !== apartmentId) continue;
    for (const listing of apartment.listings || []) {
      if (isNewListing(listing)) {
        events.push(fromListing(apartment, listing, "NEW", null, listing.unit, listing.firstSeen));
      }
      if (isPriceDrop(listing)) {
        const change = listing.price - listing.previousPrice;
        const percent = listing.previousPrice
          ? Math.round((change / listing.previousPrice) * 10000) / 100
          : null;
        events.push(
          fromListing(apartment, listing, "PRICE_DROP", String(listing.previousPrice), String(listing.price), listing.lastSeen, {
            previousPrice: listing.previousPrice,
            currentPrice: listing.price,
            priceChange: change,
            priceChangePercent: percent,
          }),
        );
      } else if (listing.previousPrice != null && listing.price != null && listing.previousPrice < listing.price) {
        const change = listing.price - listing.previousPrice;
        const percent = listing.previousPrice
          ? Math.round((change / listing.previousPrice) * 10000) / 100
          : null;
        events.push(
          fromListing(apartment, listing, "PRICE_INCREASE", String(listing.previousPrice), String(listing.price), listing.lastSeen, {
            previousPrice: listing.previousPrice,
            currentPrice: listing.price,
            priceChange: change,
            priceChangePercent: percent,
          }),
        );
      }
      if (listing.isActive === false) {
        events.push(fromListing(apartment, listing, "REMOVED", listing.unit, null, listing.lastSeen));
      }
    }
  }

  return events
    .filter((event) => !type || event.changeType === type)
    .sort((left, right) => Date.parse(right.detectedAt || 0) - Date.parse(left.detectedAt || 0));
}

function fromListing(apartment, listing, changeType, previousValue, newValue, detectedAt, details = null) {
  return {
    id: `${listing.id}-${changeType}`,
    listingId: listing.id,
    apartmentId: apartment.id,
    apartmentName: apartment.name,
    unit: listing.unit,
    changeType,
    previousValue,
    newValue,
    detectedAt,
    listingUrl: listing.listingUrl,
    details,
  };
}
