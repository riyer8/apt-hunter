export function formatPrice(value) {
  if (value == null) return "Price not listed";
  return `$${Number(value).toLocaleString("en-US")}`;
}

export function formatBeds(value) {
  if (value == null) return null;
  if (value === 0) return "Studio";
  return value === 1 ? "1 bed" : `${value} beds`;
}

export function formatBaths(value) {
  if (value == null) return null;
  return value === 1 ? "1 bath" : `${value} baths`;
}

export function formatSqft(value) {
  if (value == null) return null;
  return `${Number(value).toLocaleString("en-US")} sqft`;
}

export function formatAvailable(value) {
  if (value == null) return "Date not listed";
  if (value === "now") return "Available now";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return `Available ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return `Available ${value}`;
}

export function formatAvailableShort(value) {
  if (value == null) return "—";
  if (value === "now") return "Now";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return String(value);
}

export function formatBedsShort(value) {
  if (value == null) return "—";
  if (value === 0) return "Studio";
  return String(value);
}

export function formatBathsShort(value) {
  if (value == null) return "—";
  return String(value);
}

export function formatBedsBathsShort(listing) {
  if (listing?.bedrooms == null && listing?.bathrooms == null) return "—";
  return `${formatBedsShort(listing.bedrooms)} / ${formatBathsShort(listing.bathrooms)}`;
}

export function formatPriceShort(value) {
  if (value == null) return "—";
  return `$${Number(value).toLocaleString("en-US")}`;
}

export function formatRelativeTime(iso) {
  if (!iso) return "Never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Unknown";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDateTime(iso) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatClock(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatUntil(iso) {
  if (!iso) return "unscheduled";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unscheduled";
  const seconds = Math.round((then - Date.now()) / 1000);
  if (seconds <= 0) return "soon";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours} hour${hours === 1 ? "" : "s"}`;
}

export function listingTitle(listing) {
  if (listing.unit) return `Unit ${listing.unit}`;
  if (listing.floorPlan) return listing.floorPlan;
  return "Unit";
}

export function specLine(listing) {
  return [formatBeds(listing.bedrooms), formatBaths(listing.bathrooms), formatSqft(listing.sqft)].filter(Boolean).join(" · ");
}

export function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
