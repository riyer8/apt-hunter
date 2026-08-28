/** Curation flags for buildings and individual units (separate from monitor_state). */

export function itemPassesSelection(item, filters = {}) {
  if (!item) return false;
  if (item.isDiscarded && !filters.showDiscarded) return false;
  if (filters.selectionScope === "favorite" && !item.isFavorite) return false;
  if (filters.selectionScope === "watchlist" && !item.isWatchlisted) return false;
  return true;
}

export function apartmentPassesSelection(apartment, filters = {}) {
  return itemPassesSelection(apartment, filters);
}

export function listingPassesSelection(listing, filters = {}) {
  return itemPassesSelection(listing, filters);
}

export function selectionSummary(item) {
  const parts = [];
  if (item?.isFavorite) parts.push("Favorite");
  if (item?.isWatchlisted) parts.push("Watchlist");
  if (item?.isDiscarded) parts.push("Hidden");
  return parts;
}
