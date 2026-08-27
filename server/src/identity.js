export function listingIdentityKey(listing) {
  const unit = slug(listing?.unit);
  if (unit) return `unit:${unit}`;

  const url = listing?.listingUrl || listing?.listing_url;
  if (url) {
    const canonical = tryCanonicalUrl(url);
    if (canonical) return `url:${canonical}`;
  }

  const plan = slug(listing?.floorPlan || listing?.floor_plan);
  if (plan) return `plan:${plan}`;
  return null;
}

function tryCanonicalUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`.toLowerCase();
  } catch {
    const trimmed = String(value).trim().replace(/\/+$/, "").toLowerCase();
    return trimmed || null;
  }
}

function slug(value) {
  if (value == null || value === "") return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
