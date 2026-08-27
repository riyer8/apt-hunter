import { listingIdentityKey } from "./identity.js";
import { planScrape } from "./detectChanges.js";
import {
  monitoringStatusFromOutcome,
  scrapeStatusFromOutcome,
  toApiAlertPrefs,
  toApiApartment,
  toApiChange,
  toApiListing,
  toApiNotification,
  toApiScrapeRun,
} from "./serialize.js";
import { pool, query } from "./db.js";
import { decideNotification } from "./notify.js";

const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;
const CHANGE_TYPES = new Set([
  "NEW",
  "PRICE_DROP",
  "PRICE_INCREASE",
  "AVAILABILITY_CHANGED",
  "REMOVED",
]);

export async function getApartmentRow(id) {
  const result = await query("SELECT * FROM apartments WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function listApartmentRows() {
  const result = await query("SELECT * FROM apartments ORDER BY created_at DESC");
  return result.rows;
}

export async function listingsForApartments(apartmentIds, { includeInactive = false } = {}) {
  if (!apartmentIds.length) return [];
  const result = await query(
    `SELECT * FROM listings
     WHERE apartment_id = ANY($1::uuid[])
       AND ($2::boolean OR is_active = true)
     ORDER BY unit NULLS LAST, floor_plan NULLS LAST`,
    [apartmentIds, includeInactive],
  );
  return result.rows;
}

export async function previousPricesFor(listingIds) {
  if (!listingIds.length) return new Map();
  const result = await query(
    `SELECT listing_id, price FROM (
       SELECT listing_id, price,
              row_number() OVER (PARTITION BY listing_id ORDER BY captured_at DESC) AS rn
       FROM listing_snapshots
       WHERE listing_id = ANY($1::uuid[])
     ) ranked
     WHERE rn = 2`,
    [listingIds],
  );
  const map = new Map();
  for (const row of result.rows) {
    if (row.price != null) map.set(row.listing_id, Number(row.price));
  }
  return map;
}

export async function assembleApartments(rows, options = {}) {
  const apartmentIds = rows.map((row) => row.id);
  const listings = await listingsForApartments(apartmentIds, options);
  const previous = await previousPricesFor(listings.map((row) => row.id));
  const scrapeMeta = await scrapeMetaFor(apartmentIds);
  const changeCounts = await changeCountsFor(apartmentIds, new Date(Date.now() - CHANGE_WINDOW_MS).toISOString());
  const prefs = await alertPrefsFor(apartmentIds);

  const byApartment = new Map();
  for (const listing of listings) {
    const apartment = rows.find((row) => row.id === listing.apartment_id);
    const previousPrice = previous.get(listing.id);
    const serialized = toApiListing(
      listing,
      apartment?.name,
      previousPrice != null && previousPrice !== Number(listing.price) ? previousPrice : null,
    );
    const bucket = byApartment.get(listing.apartment_id) || [];
    bucket.push(serialized);
    byApartment.set(listing.apartment_id, bucket);
  }

  return rows.map((row) =>
    toApiApartment(row, byApartment.get(row.id) || [], {
      lastSuccessfulScrape: scrapeMeta.get(row.id)?.lastSuccessfulScrape || null,
      lastAttemptAt: scrapeMeta.get(row.id)?.lastAttemptAt || null,
      lastScrapeStatus: scrapeMeta.get(row.id)?.lastScrapeStatus || null,
      changeSummary: changeCounts.get(row.id) || emptyChangeSummary(),
      alertPreferences: toApiAlertPrefs(prefs.get(row.id)),
    }),
  );
}

export async function createOrGetApartment({ name, url, canonicalUrl, location }) {
  const existing = await query("SELECT * FROM apartments WHERE canonical_url = $1", [canonicalUrl]);
  if (existing.rows[0]) {
    return { apartment: existing.rows[0], created: false };
  }

  const inserted = await query(
    `INSERT INTO apartments (name, source_url, canonical_url, location, monitor_state, next_scrape_at)
     VALUES ($1, $2, $3, $4, 'active', now())
     RETURNING *`,
    [name, url, canonicalUrl, location],
  );
  await ensureAlertPrefs(inserted.rows[0].id);
  return { apartment: inserted.rows[0], created: true };
}

export async function deleteApartment(id) {
  const result = await query("DELETE FROM apartments WHERE id = $1 RETURNING id", [id]);
  return Boolean(result.rowCount);
}

export async function recordScrape(apartment, payload) {
  const startedAt = payload.startedAt || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const status = scrapeStatusFromOutcome(payload.outcome);
  const failed = status === "failed";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const run = await client.query(
      `INSERT INTO scrape_runs (
         apartment_id, started_at, completed_at, status, extraction_method, listings_found, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        apartment.id,
        startedAt,
        completedAt,
        status,
        payload.extractionMethod,
        0,
        failed ? payload.errorMessage || "Scrape failed" : null,
      ],
    );

    if (failed) {
      await client.query(
        `UPDATE apartments
         SET monitoring_status = $2, last_checked_at = $3, updated_at = now()
         WHERE id = $1`,
        [apartment.id, monitoringStatusFromOutcome(payload.outcome), completedAt],
      );
      await client.query("COMMIT");
      return run.rows[0];
    }

    const previous = await client.query("SELECT * FROM listings WHERE apartment_id = $1", [apartment.id]);
    const plan = planScrape({
      previousListings: previous.rows,
      incomingListings: payload.listings,
      outcome: payload.outcome,
    });

    await client.query("UPDATE scrape_runs SET listings_found = $2 WHERE id = $1", [
      run.rows[0].id,
      plan.incomingByKey.size,
    ]);

    const listingByKey = new Map(previous.rows.map((row) => [row.identity_key, row]));

    for (const [identityKey, incoming] of plan.incomingByKey) {
      const saved = await upsertListing(client, apartment.id, identityKey, incoming, completedAt);
      listingByKey.set(identityKey, saved);
    }

    for (const removal of plan.removals) {
      if (plan.incomingByKey.has(removal.identityKey)) continue;
      await client.query(
        `UPDATE listings
         SET missing_success_count = $3, is_active = $4
         WHERE apartment_id = $1 AND identity_key = $2`,
        [apartment.id, removal.identityKey, removal.missingSuccessCount, removal.isActive],
      );
    }

    const prefs = toApiAlertPrefs(await loadAlertPrefs(client, apartment.id));

    for (const event of plan.events) {
      const listing = listingByKey.get(event.identityKey);
      if (!listing) continue;
      const insertedChange = await client.query(
        `INSERT INTO listing_changes (
           listing_id, apartment_id, scrape_run_id, change_type,
           previous_value, new_value, details, detected_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          listing.id,
          apartment.id,
          run.rows[0].id,
          event.type,
          event.previousValue,
          event.newValue,
          event.details || null,
          completedAt,
        ],
      );
      if (status === "success") {
        await insertNotificationForChange(client, {
          change: insertedChange.rows[0],
          listing: { ...listing, apartmentName: apartment.name, apartmentId: apartment.id },
          outcome: payload.outcome,
          prefs,
        });
      }
    }

    await client.query(
      `UPDATE apartments
       SET monitoring_status = $2, last_checked_at = $3, updated_at = now()
       WHERE id = $1`,
      [apartment.id, monitoringStatusFromOutcome(payload.outcome), completedAt],
    );

    await client.query("COMMIT");
    run.rows[0].listings_found = plan.incomingByKey.size;
    return run.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertListing(client, apartmentId, identityKey, listing, nowIso) {
  const firstSeen = listing.firstSeen || listing.first_seen_at || nowIso;
  const lastSeen = listing.lastSeen || listing.last_seen_at || nowIso;
  const existing = await client.query(
    "SELECT * FROM listings WHERE apartment_id = $1 AND identity_key = $2",
    [apartmentId, identityKey],
  );
  const current = existing.rows[0];
  const key = identityKey || listingIdentityKey(listing);

  const values = [
    listing.unit ?? null,
    listing.price ?? null,
    listing.bedrooms ?? null,
    listing.bathrooms ?? null,
    listing.sqft ?? null,
    listing.availableDate ?? listing.available_date ?? null,
    listing.floorPlan ?? listing.floor_plan ?? null,
    listing.listingUrl ?? listing.listing_url ?? null,
    listing.confidence ?? null,
    listing.source ?? null,
  ];

  if (!current) {
    const inserted = await client.query(
      `INSERT INTO listings (
         apartment_id, identity_key, unit, price, bedrooms, bathrooms, sqft,
         available_date, floor_plan, listing_url, first_seen_at, last_seen_at,
         is_active, missing_success_count, confidence, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 0, $13, $14)
       RETURNING *`,
      [apartmentId, key, ...values.slice(0, 8), firstSeen, lastSeen, values[8], values[9]],
    );
    await insertSnapshot(client, inserted.rows[0].id, inserted.rows[0].price, inserted.rows[0].available_date, lastSeen);
    return inserted.rows[0];
  }

  const priceChanged = (current.price ?? null) !== (values[1] ?? null);
  const dateChanged = (current.available_date ?? null) !== (values[5] ?? null);

  const updated = await client.query(
    `UPDATE listings SET
       unit = $2,
       price = $3,
       bedrooms = $4,
       bathrooms = $5,
       sqft = $6,
       available_date = $7,
       floor_plan = $8,
       listing_url = $9,
       last_seen_at = $10,
       is_active = true,
       missing_success_count = 0,
       confidence = $11,
       source = $12
     WHERE id = $1
     RETURNING *`,
    [current.id, ...values.slice(0, 8), lastSeen, values[8], values[9]],
  );

  if (priceChanged || dateChanged) {
    await insertSnapshot(client, current.id, values[1], values[5], lastSeen);
  }

  return updated.rows[0];
}

async function insertSnapshot(client, listingId, price, availableDate, capturedAt) {
  await client.query(
    `INSERT INTO listing_snapshots (listing_id, price, available_date, captured_at)
     VALUES ($1, $2, $3, $4)`,
    [listingId, price ?? null, availableDate ?? null, capturedAt || new Date().toISOString()],
  );
}

export async function listScrapeRuns(apartmentId) {
  const result = await query(
    `SELECT * FROM scrape_runs
     WHERE apartment_id = $1
     ORDER BY started_at DESC
     LIMIT 50`,
    [apartmentId],
  );
  return result.rows.map(toApiScrapeRun);
}

export async function listChanges({ apartmentId = null, type = null, limit = 100 } = {}) {
  const changeType = CHANGE_TYPES.has(String(type || "").toUpperCase()) ? String(type).toUpperCase() : null;
  const result = await query(
    `SELECT c.*, a.name AS apartment_name, l.unit, l.listing_url
     FROM listing_changes c
     JOIN apartments a ON a.id = c.apartment_id
     JOIN listings l ON l.id = c.listing_id
     WHERE ($1::uuid IS NULL OR c.apartment_id = $1)
       AND ($2::text IS NULL OR c.change_type = $2)
     ORDER BY c.detected_at DESC
     LIMIT $3`,
    [apartmentId, changeType, Math.min(Math.max(Number(limit) || 100, 1), 500)],
  );
  return result.rows.map(toApiChange);
}

function emptyChangeSummary() {
  return { new: 0, priceDrops: 0, availabilityChanged: 0, removed: 0 };
}

async function scrapeMetaFor(apartmentIds) {
  const map = new Map();
  if (!apartmentIds.length) return map;

  const latest = await query(
    `SELECT DISTINCT ON (apartment_id) apartment_id, status, completed_at
     FROM scrape_runs
     WHERE apartment_id = ANY($1::uuid[])
     ORDER BY apartment_id, started_at DESC`,
    [apartmentIds],
  );
  const successful = await query(
    `SELECT DISTINCT ON (apartment_id) apartment_id, completed_at
     FROM scrape_runs
     WHERE apartment_id = ANY($1::uuid[]) AND status = 'success'
     ORDER BY apartment_id, started_at DESC`,
    [apartmentIds],
  );

  for (const row of latest.rows) {
    map.set(row.apartment_id, {
      lastScrapeStatus: row.status,
      lastAttemptAt: row.completed_at,
      lastSuccessfulScrape: null,
    });
  }
  for (const row of successful.rows) {
    const current = map.get(row.apartment_id) || {
      lastScrapeStatus: null,
      lastAttemptAt: null,
      lastSuccessfulScrape: null,
    };
    current.lastSuccessfulScrape = row.completed_at;
    map.set(row.apartment_id, current);
  }
  return map;
}

async function changeCountsFor(apartmentIds, sinceIso) {
  const map = new Map();
  if (!apartmentIds.length) return map;

  const result = await query(
    `SELECT apartment_id, change_type, COUNT(*)::int AS n
     FROM listing_changes
     WHERE apartment_id = ANY($1::uuid[])
       AND detected_at >= $2
     GROUP BY apartment_id, change_type`,
    [apartmentIds, sinceIso],
  );

  for (const row of result.rows) {
    const summary = map.get(row.apartment_id) || emptyChangeSummary();
    if (row.change_type === "NEW") summary.new = row.n;
    if (row.change_type === "PRICE_DROP") summary.priceDrops = row.n;
    if (row.change_type === "AVAILABILITY_CHANGED") summary.availabilityChanged = row.n;
    if (row.change_type === "REMOVED") summary.removed = row.n;
    map.set(row.apartment_id, summary);
  }
  return map;
}

export async function setMonitorState(id, state) {
  const next = state === "active" ? "active" : "paused";
  const result =
    next === "active"
      ? await query(
          `UPDATE apartments
           SET monitor_state = 'active',
               next_scrape_at = LEAST(COALESCE(next_scrape_at, now()), now()),
               scrape_lock_at = NULL,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [id],
        )
      : await query(
          `UPDATE apartments
           SET monitor_state = 'paused',
               scrape_lock_at = NULL,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [id],
        );
  return result.rows[0] || null;
}

export async function claimScrapeLock(id, _at, staleMs = 6 * 60 * 1000) {
  const result = await query(
    `UPDATE apartments
     SET scrape_lock_at = now(), updated_at = now()
     WHERE id = $1
       AND (scrape_lock_at IS NULL OR scrape_lock_at < now() - ($2::bigint * interval '1 millisecond'))
     RETURNING *`,
    [id, staleMs],
  );
  return result.rows[0] || null;
}

export async function releaseScrapeLock(id) {
  await query("UPDATE apartments SET scrape_lock_at = NULL, updated_at = now() WHERE id = $1", [id]);
}

export async function updateSchedule(id, patch) {
  const keepNext = Boolean(patch.keepNextScrape);
  await query(
    `UPDATE apartments SET
       consecutive_failures = $2,
       last_error = $3,
       next_scrape_at = CASE WHEN $5::boolean THEN next_scrape_at ELSE $4::timestamptz END,
       scrape_lock_at = NULL,
       updated_at = now()
     WHERE id = $1`,
    [id, patch.consecutiveFailures || 0, patch.lastError || null, patch.nextScrapeAt || null, keepNext],
  );
}

export async function ensureAlertPrefs(apartmentId, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `INSERT INTO alert_preferences (apartment_id) VALUES ($1)
     ON CONFLICT (apartment_id) DO NOTHING`,
    [apartmentId],
  );
}

async function loadAlertPrefs(client, apartmentId) {
  await ensureAlertPrefs(apartmentId, client);
  const result = await client.query("SELECT * FROM alert_preferences WHERE apartment_id = $1", [apartmentId]);
  return result.rows[0] || null;
}

async function alertPrefsFor(apartmentIds) {
  const map = new Map();
  if (!apartmentIds.length) return map;
  const result = await query("SELECT * FROM alert_preferences WHERE apartment_id = ANY($1::uuid[])", [apartmentIds]);
  for (const row of result.rows) map.set(row.apartment_id, row);
  return map;
}

export async function getAlertPrefs(apartmentId) {
  await ensureAlertPrefs(apartmentId);
  const result = await query("SELECT * FROM alert_preferences WHERE apartment_id = $1", [apartmentId]);
  return toApiAlertPrefs(result.rows[0]);
}

export async function saveAlertPrefs(apartmentId, prefs) {
  await ensureAlertPrefs(apartmentId);
  const result = await query(
    `UPDATE alert_preferences SET
       new_listings = $2,
       price_drops = $3,
       price_increases = $4,
       availability_changes = $5,
       max_rent = $6,
       min_sqft = $7,
       bedrooms = $8,
       bathrooms = $9,
       available_by = $10,
       updated_at = now()
     WHERE apartment_id = $1
     RETURNING *`,
    [
      apartmentId,
      prefs.newListings !== false,
      prefs.priceDrops !== false,
      prefs.priceIncreases === true,
      prefs.availabilityChanges !== false,
      emptyToNull(prefs.maxRent),
      emptyToNull(prefs.minSqft),
      emptyToNull(prefs.bedrooms),
      emptyToNull(prefs.bathrooms),
      prefs.availableBy || null,
    ],
  );
  return toApiAlertPrefs(result.rows[0]);
}

async function insertNotificationForChange(client, { change, listing, outcome, prefs }) {
  const already = await client.query("SELECT change_id FROM notifications WHERE change_id = $1", [change.id]);
  const decided = decideNotification({
    outcome,
    change: { id: change.id, type: change.change_type, apartmentId: change.apartment_id },
    listing: {
      ...listing,
      availableDate: listing.availableDate || listing.available_date,
      listingUrl: listing.listingUrl || listing.listing_url,
      floorPlan: listing.floorPlan || listing.floor_plan,
    },
    prefs,
    alreadyNotifiedChangeIds: new Set(already.rows.map((row) => row.change_id)),
    dashboardOrigin: process.env.DASHBOARD_URL || "http://localhost:5173",
  });
  if (!decided.notify) return null;
  const record = decided.notification;
  await client.query(
    `INSERT INTO notifications (
       change_id, apartment_id, listing_id, notification_type, title, body, listing_url, click_url, delivery_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     ON CONFLICT (change_id) DO NOTHING`,
    [
      record.changeId,
      record.apartmentId,
      record.listingId,
      record.notificationType,
      record.title,
      record.body,
      record.listingUrl,
      record.clickUrl,
    ],
  );
  return record;
}

export async function listNotifications({ unreadOnly = false, pendingDelivery = false, limit = 50 } = {}) {
  const result = await query(
    `SELECT n.*, a.name AS apartment_name, l.unit
     FROM notifications n
     JOIN apartments a ON a.id = n.apartment_id
     LEFT JOIN listings l ON l.id = n.listing_id
     WHERE ($1::boolean IS NOT TRUE OR n.read_at IS NULL)
       AND ($2::boolean IS NOT TRUE OR n.delivery_status = 'pending')
     ORDER BY n.created_at DESC
     LIMIT $3`,
    [unreadOnly, pendingDelivery, Math.min(Math.max(Number(limit) || 50, 1), 200)],
  );
  return result.rows.map(toApiNotification);
}

export async function unreadNotificationCount() {
  const result = await query("SELECT COUNT(*)::int AS n FROM notifications WHERE read_at IS NULL");
  return result.rows[0]?.n || 0;
}

export async function markNotificationRead(id) {
  const result = await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ? toApiNotification(result.rows[0]) : null;
}

export async function markAllNotificationsRead() {
  await query("UPDATE notifications SET read_at = now() WHERE read_at IS NULL");
}

export async function claimNotificationDelivery(id) {
  const result = await query(
    `UPDATE notifications
     SET delivery_status = 'delivered', delivered_at = now()
     WHERE id = $1 AND delivery_status = 'pending'
     RETURNING *`,
    [id],
  );
  return result.rows[0] ? toApiNotification(result.rows[0]) : null;
}

function emptyToNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
