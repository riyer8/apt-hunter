import { listingIdentityKey } from "./identity.js";

export { listingIdentityKey };

export const CHANGE_TYPE = {
  NEW: "NEW",
  PRICE_DROP: "PRICE_DROP",
  PRICE_INCREASE: "PRICE_INCREASE",
  AVAILABILITY_CHANGED: "AVAILABILITY_CHANGED",
  REMOVED: "REMOVED",
};

export const REMOVAL_THRESHOLD = 2;

export function normalizeIncoming(listing) {
  return {
    unit: listing.unit ?? null,
    price: listing.price == null || listing.price === "" ? null : Number(listing.price),
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqft: listing.sqft ?? null,
    availableDate: listing.availableDate ?? listing.available_date ?? null,
    floorPlan: listing.floorPlan ?? listing.floor_plan ?? null,
    listingUrl: listing.listingUrl ?? listing.listing_url ?? null,
    confidence: listing.confidence ?? null,
    source: listing.source ?? null,
    identityKey: listingIdentityKey(listing),
  };
}

export function dedupeByIdentity(listings) {
  const map = new Map();
  for (const listing of listings || []) {
    const normalized = normalizeIncoming(listing);
    if (!normalized.identityKey) continue;
    if (!map.has(normalized.identityKey)) map.set(normalized.identityKey, normalized);
  }
  return map;
}

export function priceDelta(previousPrice, currentPrice) {
  if (previousPrice == null || currentPrice == null) return null;
  const previous = Number(previousPrice);
  const current = Number(currentPrice);
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === current) return null;
  const change = current - previous;
  const percent = previous === 0 ? null : Math.round((change / previous) * 10000) / 100;
  return {
    change,
    percent,
    type: change < 0 ? CHANGE_TYPE.PRICE_DROP : CHANGE_TYPE.PRICE_INCREASE,
  };
}

export function compareListing(previous, incoming) {
  if (!previous) {
    return [
      {
        type: CHANGE_TYPE.NEW,
        previousValue: null,
        newValue: incoming.unit || incoming.identityKey,
        details: null,
      },
    ];
  }

  const events = [];
  const delta = priceDelta(previous.price, incoming.price);
  if (delta) {
    events.push({
      type: delta.type,
      previousValue: String(previous.price),
      newValue: String(incoming.price),
      details: {
        previousPrice: Number(previous.price),
        currentPrice: Number(incoming.price),
        priceChange: delta.change,
        priceChangePercent: delta.percent,
      },
    });
  }

  const previousDate = previous.availableDate ?? previous.available_date ?? null;
  const nextDate = incoming.availableDate ?? incoming.available_date ?? null;
  if (previousDate && nextDate && previousDate !== nextDate) {
    events.push({
      type: CHANGE_TYPE.AVAILABILITY_CHANGED,
      previousValue: previousDate,
      newValue: nextDate,
      details: null,
    });
  }

  return events;
}

export function planScrape({ previousListings = [], incomingListings = [], outcome }) {
  const status = String(outcome || "").toUpperCase();
  if (status === "FAILED") {
    return {
      applyListings: false,
      detectRemovals: false,
      incomingByKey: new Map(),
      events: [],
      removals: [],
    };
  }

  const detectRemovals = status === "SUCCESS";
  const incomingByKey = dedupeByIdentity(incomingListings);
  const previousByKey = new Map(
    (previousListings || [])
      .map((listing) => {
        const key = listing.identityKey || listing.identity_key || listingIdentityKey(listing);
        return key ? [key, listing] : null;
      })
      .filter(Boolean),
  );

  const events = [];
  for (const [key, incoming] of incomingByKey) {
    const previous = previousByKey.get(key);
    const mapped = previous ? mapPrevious(previous) : null;
    for (const event of compareListing(mapped, incoming)) {
      events.push({ ...event, identityKey: key, unit: incoming.unit || mapped?.unit || null });
    }
  }

  const removals = [];
  for (const [key, previous] of previousByKey) {
    if (incomingByKey.has(key)) {
      removals.push({
        identityKey: key,
        missingSuccessCount: 0,
        isActive: true,
        emitRemoved: false,
      });
      continue;
    }
    if (!detectRemovals) continue;
    if (isInactive(previous)) continue;

    const count = Number(previous.missing_success_count ?? previous.missingSuccessCount ?? 0) + 1;
    const removed = count >= REMOVAL_THRESHOLD;
    removals.push({
      identityKey: key,
      missingSuccessCount: count,
      isActive: !removed,
      emitRemoved: removed,
    });
    if (removed) {
      events.push({
        type: CHANGE_TYPE.REMOVED,
        identityKey: key,
        unit: previous.unit || null,
        previousValue: previous.unit || key,
        newValue: null,
        details: null,
      });
    }
  }

  return {
    applyListings: true,
    detectRemovals,
    incomingByKey,
    events,
    removals,
  };
}

function mapPrevious(listing) {
  return {
    unit: listing.unit ?? null,
    price: listing.price ?? null,
    availableDate: listing.availableDate ?? listing.available_date ?? null,
    identityKey: listing.identityKey || listing.identity_key,
  };
}

function isInactive(listing) {
  if (listing.is_active === false || listing.isActive === false) return true;
  return false;
}
