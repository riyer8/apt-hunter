import { formatPriceShort, listingTitle } from "./format.js";

function listingLabel(listing) {
  const building = listing.apartmentName;
  const unit = listing.unit || listing.floorPlan || listingTitle(listing);
  return building ? `${building} · ${unit}` : unit;
}

export function summarizeListings(listings) {
  const count = listings.length;
  const buildings = [...new Set(listings.map((listing) => listing.apartmentName).filter(Boolean))];
  const prices = listings.map((listing) => listing.price).filter((price) => price != null);
  const inactive = listings.filter((listing) => listing.isActive === false).length;

  const parts = [`${count} unit${count === 1 ? "" : "s"}`];
  if (buildings.length > 1) parts.push(`${buildings.length} buildings`);
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    parts.push(min === max ? formatPriceShort(min) : `${formatPriceShort(min)}–${formatPriceShort(max)}`);
  }
  if (inactive > 0) parts.push(`${inactive} out`);

  return {
    headline: parts.join(" · "),
    preview: buildPreview(listings, listingLabel),
  };
}

export function summarizeBuildings(apartments) {
  const count = apartments.length;
  const monitoring = apartments.filter((apartment) => apartment.monitorState === "active").length;
  const listingTotal = apartments.reduce((total, apartment) => total + (apartment.listings || []).length, 0);

  const parts = [`${count} building${count === 1 ? "" : "s"}`];
  if (monitoring > 0) parts.push(`${monitoring} monitoring`);
  if (listingTotal > 0) parts.push(`${listingTotal} unit${listingTotal === 1 ? "" : "s"}`);

  return {
    headline: parts.join(" · "),
    preview: buildPreview(apartments, (apartment) => apartment.name),
  };
}

function buildPreview(items, labelFor) {
  const previewCount = 4;
  const preview = items
    .slice(0, previewCount)
    .map(labelFor)
    .join(" · ");
  const more = items.length > previewCount ? ` · +${items.length - previewCount} more` : "";
  return preview + more;
}
