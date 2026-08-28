import { listingPassesSelection } from "./selection.js";

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isNewListing(listing, now = Date.now()) {
  if (!listing?.firstSeen) return false;
  const first = Date.parse(listing.firstSeen);
  if (Number.isNaN(first)) return false;
  return now - first <= NEW_WINDOW_MS;
}

export function isPriceDrop(listing) {
  return listing?.previousPrice != null && listing.price != null && listing.previousPrice > listing.price;
}

export function priceDropAmount(listing) {
  if (!isPriceDrop(listing)) return null;
  return listing.previousPrice - listing.price;
}

export function isRecentlyChanged(listing, now = Date.now()) {
  if (!listing?.lastSeen) return false;
  const last = Date.parse(listing.lastSeen);
  if (Number.isNaN(last)) return false;
  if (now - last > NEW_WINDOW_MS) return false;
  if (!listing.firstSeen) return true;
  return listing.lastSeen !== listing.firstSeen || isNewListing(listing, now) || isPriceDrop(listing);
}

export function listingMatchesFilters(listing, filters, now = Date.now()) {
  if (!listing) return false;
  if (!listingPassesSelection(listing, filters)) return false;

  if (filters.maxRent != null && filters.maxRent !== "") {
    if (listing.price == null || listing.price > Number(filters.maxRent)) return false;
  }
  if (filters.minSqft != null && filters.minSqft !== "") {
    if (listing.sqft == null || listing.sqft < Number(filters.minSqft)) return false;
  }
  if (filters.maxSqft != null && filters.maxSqft !== "") {
    if (listing.sqft == null || listing.sqft > Number(filters.maxSqft)) return false;
  }
  if (filters.bedrooms != null && filters.bedrooms !== "") {
    const want = Number(filters.bedrooms);
    if (listing.bedrooms == null) return false;
    if (want >= 3) {
      if (listing.bedrooms < 3) return false;
    } else if (listing.bedrooms !== want) {
      return false;
    }
  }
  if (filters.bathrooms != null && filters.bathrooms !== "") {
    if (listing.bathrooms == null || listing.bathrooms < Number(filters.bathrooms)) return false;
  }
  if (filters.availableBy) {
    if (!isAvailableBy(listing.availableDate, filters.availableBy)) return false;
  }
  if (filters.minSafety != null && filters.minSafety !== "") {
    const score = listing.buildingProfile?.safetyScore;
    if (score == null || Number(score) < Number(filters.minSafety)) return false;
  }
  if (filters.minWalkability != null && filters.minWalkability !== "") {
    const score = listing.buildingProfile?.walkabilityScore;
    if (score == null || Number(score) < Number(filters.minWalkability)) return false;
  }
  if (filters.newOnly && !isNewListing(listing, now)) return false;
  if (filters.priceDropsOnly && !isPriceDrop(listing)) return false;
  if (filters.query) {
    const q = String(filters.query).trim().toLowerCase();
    if (q && !listingSearchText(listing).includes(q)) return false;
  }
  return true;
}

export const DESC_SORT_KEYS = new Set([
  "newest",
  "changed",
  "safety",
  "buildingAge",
  "walkability",
  "viewsSun",
  "amenities",
  "overall",
  "match",
]);

export function sortListings(listings, sortKey = "unit", sortDir) {
  const key = sortKey || "unit";
  const defaultDir = DESC_SORT_KEYS.has(key) ? "desc" : "asc";
  const dir = sortDir || defaultDir;
  const copy = [...listings].sort((left, right) => compareListings(left, right, key));
  if (dir === "desc" && !DESC_SORT_KEYS.has(key)) copy.reverse();
  if (dir === "asc" && DESC_SORT_KEYS.has(key)) copy.reverse();
  return copy;
}

export function sortListingsWithCuratedPriority(listings, sortKey = "unit", sortDir) {
  const sorted = sortListings(listings, sortKey, sortDir);
  const favorites = [];
  const watchlist = [];
  const rest = [];
  for (const listing of sorted) {
    if (listing.isFavorite) favorites.push(listing);
    else if (listing.isWatchlisted) watchlist.push(listing);
    else rest.push(listing);
  }
  return [...favorites, ...watchlist, ...rest];
}

export function compareListings(left, right, key) {
  switch (key) {
    case "price":
      return (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY);
    case "beds":
    case "bedrooms":
      return (left.bedrooms ?? -1) - (right.bedrooms ?? -1);
    case "sqft":
      return (left.sqft ?? -1) - (right.sqft ?? -1);
    case "availability":
    case "available":
      return availabilityRank(left.availableDate) - availabilityRank(right.availableDate);
    case "newest":
      return Date.parse(right.firstSeen || 0) - Date.parse(left.firstSeen || 0);
    case "changed":
      return Date.parse(right.lastSeen || 0) - Date.parse(left.lastSeen || 0);
    case "building":
      return String(left.apartmentName || "").localeCompare(String(right.apartmentName || ""), undefined, {
        sensitivity: "base",
      });
    case "match":
      return (right.match?.score ?? -1) - (left.match?.score ?? -1);
    case "safety":
    case "buildingAge":
    case "walkability":
    case "viewsSun":
    case "amenities":
    case "overall":
      return (buildingScore(right, key) ?? -1) - (buildingScore(left, key) ?? -1);
    default:
      return String(left.unit || left.floorPlan || "").localeCompare(
        String(right.unit || right.floorPlan || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
  }
}

function buildingScore(listing, key) {
  const profile = listing?.buildingProfile;
  if (!profile) return null;
  if (key === "safety") return profile.safetyScore;
  if (key === "buildingAge") return profile.buildingAgeScore;
  if (key === "walkability") return profile.walkabilityScore;
  if (key === "viewsSun") return profile.viewsSunScore;
  if (key === "amenities") return profile.amenitiesScore;
  if (key === "overall") return profile.overallScore;
  return null;
}

export function listingSearchText(listing) {
  return [
    listing.apartmentName,
    listing.unit,
    listing.floorPlan,
    listing.price,
    listing.bedrooms,
    listing.sqft,
  ]
    .filter((value) => value != null && value !== "")
    .join(" ")
    .toLowerCase();
}

function isAvailableBy(availableDate, cutoff) {
  if (!availableDate) return false;
  if (availableDate === "now") return true;
  const listingDate = parseAvailableDate(availableDate);
  const limit = Date.parse(cutoff);
  if (!listingDate || Number.isNaN(limit)) return false;
  return listingDate.getTime() <= limit;
}

function parseAvailableDate(value) {
  if (value === "now") return new Date();
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const md = String(value).match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const year = new Date().getFullYear();
    return new Date(year, Number(md[1]) - 1, Number(md[2]));
  }
  const named = Date.parse(`${value} ${new Date().getFullYear()}`);
  if (!Number.isNaN(named)) return new Date(named);
  return null;
}

function availabilityRank(value) {
  if (value === "now") return 0;
  const date = parseAvailableDate(value);
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}
