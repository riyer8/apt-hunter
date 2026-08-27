export const NOTIFY_TYPES = {
  NEW_LISTING: "NEW_LISTING",
  PRICE_DROP: "PRICE_DROP",
  PRICE_INCREASE: "PRICE_INCREASE",
  AVAILABILITY_CHANGED: "AVAILABILITY_CHANGED",
};

export const CHANGE_TO_NOTIFY = {
  NEW: NOTIFY_TYPES.NEW_LISTING,
  PRICE_DROP: NOTIFY_TYPES.PRICE_DROP,
  PRICE_INCREASE: NOTIFY_TYPES.PRICE_INCREASE,
  AVAILABILITY_CHANGED: NOTIFY_TYPES.AVAILABILITY_CHANGED,
};

export const DEFAULT_ALERT_PREFS = {
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

const TYPE_ENABLED = {
  NEW_LISTING: "newListings",
  PRICE_DROP: "priceDrops",
  PRICE_INCREASE: "priceIncreases",
  AVAILABILITY_CHANGED: "availabilityChanges",
};

const TYPE_COPY = {
  NEW_LISTING: { emoji: "🏠", title: "NEW APARTMENT", bell: "🆕" },
  PRICE_DROP: { emoji: "💰", title: "PRICE DROP", bell: "💰" },
  PRICE_INCREASE: { emoji: "📈", title: "PRICE INCREASE", bell: "📈" },
  AVAILABILITY_CHANGED: { emoji: "📅", title: "AVAILABILITY CHANGED", bell: "📅" },
};

const DISABLED_NOTICE = "Browser notifications are disabled. Enable notifications to receive alerts.";

export function defaultAlertPrefs(overrides = {}) {
  return { ...DEFAULT_ALERT_PREFS, ...overrides };
}

export function notifyTypeForChange(changeType) {
  return CHANGE_TO_NOTIFY[changeType] || null;
}

export function decideNotification({
  outcome,
  change,
  listing,
  prefs = DEFAULT_ALERT_PREFS,
  alreadyNotifiedChangeIds = new Set(),
  dashboardOrigin = "http://localhost:5173",
}) {
  const status = String(outcome || "").toUpperCase();
  if (status === "FAILED") {
    return { notify: false, reason: "failed-scrape" };
  }
  if (status !== "SUCCESS") {
    return { notify: false, reason: "unconfirmed-scrape" };
  }

  const changeId = change?.id || change?.changeId;
  if (changeId && alreadyNotifiedChangeIds.has(changeId)) {
    return { notify: false, reason: "duplicate" };
  }

  const type = notifyTypeForChange(change?.type || change?.changeType);
  if (!type) {
    return { notify: false, reason: "unsupported-type" };
  }

  const merged = defaultAlertPrefs(prefs);
  const flag = TYPE_ENABLED[type];
  if (!merged[flag]) {
    return { notify: false, reason: "pref-disabled" };
  }

  if (!listingMatchesAlertFilters(listing, merged)) {
    return { notify: false, reason: "filtered" };
  }

  return {
    notify: true,
    reason: null,
    notification: buildNotificationRecord({ type, change, listing, dashboardOrigin }),
  };
}

export function listingMatchesAlertFilters(listing, prefs = {}) {
  if (!listing) return false;
  if (prefs.maxRent != null && prefs.maxRent !== "") {
    if (listing.price == null || Number(listing.price) > Number(prefs.maxRent)) return false;
  }
  if (prefs.minSqft != null && prefs.minSqft !== "") {
    if (listing.sqft == null || Number(listing.sqft) < Number(prefs.minSqft)) return false;
  }
  if (prefs.bedrooms != null && prefs.bedrooms !== "") {
    const want = Number(prefs.bedrooms);
    if (listing.bedrooms == null) return false;
    if (want >= 3) {
      if (Number(listing.bedrooms) < 3) return false;
    } else if (Number(listing.bedrooms) !== want) {
      return false;
    }
  }
  if (prefs.bathrooms != null && prefs.bathrooms !== "") {
    if (listing.bathrooms == null || Number(listing.bathrooms) < Number(prefs.bathrooms)) return false;
  }
  if (prefs.availableBy) {
    if (!isAvailableBy(listing.availableDate || listing.available_date, prefs.availableBy)) return false;
  }
  return true;
}

export function buildNotificationRecord({ type, change, listing, dashboardOrigin }) {
  const copy = TYPE_COPY[type];
  const apartmentName = listing.apartmentName || listing.apartment_name || "Apartment";
  const unit = listing.unit ? `Unit ${listing.unit}` : listing.floorPlan || listing.floor_plan || "New listing";
  const listingUrl = listing.listingUrl || listing.listing_url || null;
  const apartmentId = listing.apartmentId || listing.apartment_id || change?.apartmentId || change?.apartment_id;
  const clickUrl = listingUrl || `${String(dashboardOrigin || "http://localhost:5173").replace(/\/$/, "")}/apartments/${apartmentId}`;

  return {
    changeId: change?.id || change?.changeId || null,
    apartmentId,
    listingId: listing.id || listing.listing_id || null,
    notificationType: type,
    title: `${copy.emoji} ${copy.title}`,
    body: [
      `${apartmentName} — ${unit}`,
      formatPriceLine(listing.price),
      specLine(listing),
      formatAvailableLine(listing.availableDate || listing.available_date),
    ]
      .filter(Boolean)
      .join("\n"),
    listingUrl,
    clickUrl,
    bellEmoji: copy.bell,
    deliveryStatus: "pending",
  };
}

export function chromeNotificationOptions(record) {
  return {
    type: "basic",
    title: record.title,
    message: record.body,
    priority: 1,
  };
}

export function notificationClickUrl(record, dashboardOrigin = "http://localhost:5173") {
  return record.listingUrl || record.clickUrl || `${dashboardOrigin}/apartments/${record.apartmentId}`;
}

export function browserPermissionDecision(permission, { asked = false } = {}) {
  if (permission === "granted") {
    return { enabled: true, showPrompt: false, notice: null };
  }
  if (permission === "denied" || asked) {
    return { enabled: false, showPrompt: false, notice: DISABLED_NOTICE };
  }
  return { enabled: false, showPrompt: true, notice: null };
}

function formatPriceLine(price) {
  if (price == null || price === "") return null;
  return `$${Number(price).toLocaleString("en-US")}/mo`;
}

function specLine(listing) {
  const beds =
    listing.bedrooms === 0 || listing.bedrooms === "0"
      ? "Studio"
      : listing.bedrooms != null
        ? `${listing.bedrooms} bed`
        : null;
  const sqft = listing.sqft != null ? `${Number(listing.sqft).toLocaleString("en-US")} sqft` : null;
  return [beds, sqft].filter(Boolean).join(" · ") || null;
}

function formatAvailableLine(value) {
  if (value == null || value === "") return null;
  if (value === "now") return "Available now";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return `Available ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return `Available ${value}`;
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
  return null;
}
