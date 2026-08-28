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

export function toApiApartment(row, listings = [], extras = {}) {
  return {
    id: row.id,
    name: row.name,
    url: row.source_url,
    location: row.location,
    dateAdded: toIso(row.created_at),
    status: STATUS_TO_UI[row.monitoring_status] || STATUS_TO_UI.not_analyzed,
    lastChecked: toIso(row.last_checked_at),
    lastSuccessfulScrape: toIso(extras.lastSuccessfulScrape),
    lastAttemptAt: toIso(extras.lastAttemptAt || row.last_checked_at),
    lastScrapeStatus: extras.lastScrapeStatus || row.monitoring_status || null,
    monitorState: row.monitor_state || "paused",
    nextScrapeAt: toIso(row.next_scrape_at),
    consecutiveFailures: Number(row.consecutive_failures || 0),
    lastError: row.last_error || null,
    scrapeInProgress: Boolean(row.scrape_lock_at),
    changeSummary: extras.changeSummary || {
      new: 0,
      priceDrops: 0,
      availabilityChanged: 0,
      removed: 0,
    },
    listings,
    alertPreferences: extras.alertPreferences || null,
    features: extras.features || {},
    buildingProfile: extras.buildingProfile || null,
    isFavorite: row.is_favorite === true,
    isWatchlisted: row.is_watchlisted === true,
    isDiscarded: row.is_discarded === true,
  };
}

export function toApiListing(row, apartmentName, previousPrice = null, extras = {}) {
  return {
    id: row.id,
    apartmentId: row.apartment_id || extras.apartmentId || null,
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
    features: extras.features || {},
    location: extras.location || null,
    match: extras.match || null,
    buildingProfile: extras.buildingProfile || null,
    isFavorite: row.is_favorite === true,
    isWatchlisted: row.is_watchlisted === true,
    isDiscarded: row.is_discarded === true,
  };
}

export function toApiChange(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    apartmentId: row.apartment_id,
    apartmentName: row.apartment_name || null,
    unit: row.unit || null,
    changeType: row.change_type,
    previousValue: row.previous_value,
    newValue: row.new_value,
    detectedAt: toIso(row.detected_at),
    listingUrl: row.listing_url || null,
    details: row.details || null,
  };
}

export function toApiNotification(row) {
  return {
    id: row.id,
    changeId: row.change_id,
    apartmentId: row.apartment_id,
    listingId: row.listing_id,
    apartmentName: row.apartment_name || null,
    unit: row.unit || null,
    notificationType: row.notification_type,
    title: row.title,
    body: row.body,
    listingUrl: row.listing_url || null,
    clickUrl: row.click_url || null,
    createdAt: toIso(row.created_at),
    readAt: toIso(row.read_at),
    deliveryStatus: row.delivery_status,
    deliveredAt: toIso(row.delivered_at),
  };
}

export function toApiAlertPrefs(row) {
  if (!row) {
    return {
      newListings: true,
      priceDrops: true,
      priceIncreases: false,
      availabilityChanges: true,
      maxRent: null,
      minSqft: null,
      bedrooms: null,
      bathrooms: null,
      availableBy: null,
    };
  }
  return {
    newListings: row.new_listings !== false,
    priceDrops: row.price_drops !== false,
    priceIncreases: row.price_increases === true,
    availabilityChanges: row.availability_changes !== false,
    maxRent: row.max_rent == null ? null : Number(row.max_rent),
    minSqft: row.min_sqft == null ? null : Number(row.min_sqft),
    bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    availableBy: row.available_by || null,
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

export function toApiProfile(row) {
  const prefs = toApiUserPrefs(row);
  return {
    id: row?.id || null,
    name: row?.name || "Search",
    sortOrder: row?.sort_order == null ? 0 : Number(row.sort_order),
    maxRent: prefs.maxRent,
    bedrooms: prefs.bedrooms,
    minBathrooms: prefs.minBathrooms,
    minSqft: prefs.minSqft,
    maxSqft: prefs.maxSqft,
    moveInEarliest: prefs.moveInEarliest,
    moveInLatest: prefs.moveInLatest,
    requiredFeatures: prefs.requiredFeatures,
    preferredFeatures: prefs.preferredFeatures,
    preferredNeighborhoods: prefs.preferredNeighborhoods,
    hard: prefs.hard,
  };
}

export function toApiUserPrefs(row) {
  const defaults = {
    maxRent: true,
    bedrooms: true,
    bathrooms: true,
    minSqft: true,
    maxSqft: false,
    moveIn: true,
    requiredFeatures: true,
    neighborhoods: false,
  };
  if (!row) {
    return {
      maxRent: null,
      bedrooms: [],
      minBathrooms: null,
      minSqft: null,
      maxSqft: null,
      moveInEarliest: null,
      moveInLatest: null,
      requiredFeatures: [],
      preferredFeatures: [],
      preferredNeighborhoods: [],
      hard: defaults,
      matchAlerts: false,
    };
  }
  return {
    maxRent: row.max_rent == null ? null : Number(row.max_rent),
    bedrooms: asArray(row.bedrooms).map(Number),
    minBathrooms: row.min_bathrooms == null ? null : Number(row.min_bathrooms),
    minSqft: row.min_sqft == null ? null : Number(row.min_sqft),
    maxSqft: row.max_sqft == null ? null : Number(row.max_sqft),
    moveInEarliest: row.move_in_earliest || null,
    moveInLatest: row.move_in_latest || null,
    requiredFeatures: asArray(row.required_features),
    preferredFeatures: asArray(row.preferred_features),
    preferredNeighborhoods: asArray(row.preferred_neighborhoods),
    hard: { ...defaults, ...(row.hard && typeof row.hard === "object" ? row.hard : {}) },
    matchAlerts: row.match_alerts === true,
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [];
}

export function toApiBuildingProfile(row) {
  if (!row) return null;
  return {
    yearBuilt: row.year_built == null ? null : Number(row.year_built),
    buildingAge: row.building_age == null ? null : Number(row.building_age),
    yearBuiltSource: row.year_built_source || null,
    safetyScore: numOrNull(row.safety_score),
    buildingAgeScore: numOrNull(row.building_age_score),
    walkabilityScore: numOrNull(row.walkability_score),
    viewsSunScore: numOrNull(row.views_sun_score),
    amenitiesScore: numOrNull(row.amenities_score),
    overallScore: numOrNull(row.overall_score),
    overallIncomplete: row.overall_incomplete === true,
    missingCategories: asArray(row.missing_categories),
    amenities: asArray(row.amenities),
    facts: row.facts || {},
    judgments: row.judgments || {},
    summary: row.summary || null,
    evidence: asArray(row.evidence),
    status: row.status || "pending",
    analyzedAt: toIso(row.analyzed_at),
    analysisVersion: Number(row.analysis_version || 0),
    model: row.model || null,
  };
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}
