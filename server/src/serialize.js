const STATUS_TO_UI = {
  not_analyzed: "Not analyzed",
  analyzing: "Analyzing…",
  success: "Availability detected",
  partial: "Partial detection",
  failed: "Could not detect",
};

const UI_TO_STATUS = {
  "Not analyzed": "not_analyzed",
  "Analyzing…": "analyzing",
  "Availability detected": "success",
  "Partial detection": "partial",
  "Could not detect": "failed",
};

export function monitoringStatusFromOutcome(outcome) {
  const value = String(outcome || "").toLowerCase();
  if (value === "success") return "success";
  if (value === "partial") return "partial";
  if (value === "failed") return "failed";
  if (value === "analyzing") return "analyzing";
  return "not_analyzed";
}

export function scrapeStatusFromOutcome(outcome) {
  return monitoringStatusFromOutcome(outcome);
}

export function toApiApartment(row, listings = []) {
  return {
    id: row.id,
    name: row.name,
    url: row.source_url,
    location: row.location,
    dateAdded: toIso(row.created_at),
    status: STATUS_TO_UI[row.monitoring_status] || STATUS_TO_UI.not_analyzed,
    lastChecked: toIso(row.last_checked_at),
    listings,
  };
}

export function toApiListing(row, apartmentName, previousPrice = null) {
  return {
    id: row.id,
    apartmentName: apartmentName || null,
    unit: row.unit,
    price: row.price == null ? null : Number(row.price),
    bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    sqft: row.sqft == null ? null : Number(row.sqft),
    availableDate: row.available_date,
    floorPlan: row.floor_plan,
    listingUrl: row.listing_url,
    sourceUrl: null,
    firstSeen: toIso(row.first_seen_at),
    lastSeen: toIso(row.last_seen_at),
    confidence: row.confidence || "LOW",
    source: row.source || null,
    sources: row.source ? [row.source] : [],
    previousPrice: previousPrice == null ? null : Number(previousPrice),
    isActive: row.is_active !== false,
  };
}

export function toApiScrapeRun(row) {
  return {
    id: row.id,
    apartmentId: row.apartment_id,
    startedAt: toIso(row.started_at),
    completedAt: toIso(row.completed_at),
    status: row.status,
    extractionMethod: row.extraction_method,
    listingsFound: row.listings_found,
    errorMessage: row.error_message,
  };
}

export function uiStatusToDb(status) {
  return UI_TO_STATUS[status] || "not_analyzed";
}

function toIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}
