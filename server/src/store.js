import { listingIdentityKey } from "./validate.js";
import { monitoringStatusFromOutcome, scrapeStatusFromOutcome, toApiApartment, toApiListing, toApiScrapeRun } from "./serialize.js";
import { query } from "./db.js";

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
  const listings = await listingsForApartments(
    rows.map((row) => row.id),
    options,
  );
  const previous = await previousPricesFor(listings.map((row) => row.id));
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
  return rows.map((row) => toApiApartment(row, byApartment.get(row.id) || []));
}

export async function createOrGetApartment({ name, url, canonicalUrl, location }) {
  const existing = await query("SELECT * FROM apartments WHERE canonical_url = $1", [canonicalUrl]);
  if (existing.rows[0]) {
    return { apartment: existing.rows[0], created: false };
  }

  const inserted = await query(
    `INSERT INTO apartments (name, source_url, canonical_url, location)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, url, canonicalUrl, location],
  );
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

  const run = await query(
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
      failed ? 0 : payload.listings.length,
      failed ? payload.errorMessage || "Scrape failed" : null,
    ],
  );

  if (failed) {
    await query(
      `UPDATE apartments
       SET monitoring_status = $2, last_checked_at = $3, updated_at = now()
       WHERE id = $1`,
      [apartment.id, monitoringStatusFromOutcome(payload.outcome), completedAt],
    );
    return run.rows[0];
  }

  const seenKeys = [];
  for (const listing of payload.listings) {
    const identityKey = listingIdentityKey(listing);
    if (!identityKey) continue;
    seenKeys.push(identityKey);
    await upsertListing(apartment.id, identityKey, listing, completedAt);
  }

  if (seenKeys.length) {
    await query(
      `UPDATE listings
       SET is_active = false
       WHERE apartment_id = $1
         AND is_active = true
         AND NOT (identity_key = ANY($2::text[]))`,
      [apartment.id, seenKeys],
    );
  }

  await query(
    `UPDATE apartments
     SET monitoring_status = $2, last_checked_at = $3, updated_at = now()
     WHERE id = $1`,
    [apartment.id, monitoringStatusFromOutcome(payload.outcome), completedAt],
  );

  return run.rows[0];
}

async function upsertListing(apartmentId, identityKey, listing, nowIso) {
  const firstSeen = listing.firstSeen || listing.first_seen_at || nowIso;
  const lastSeen = listing.lastSeen || listing.last_seen_at || nowIso;
  const existing = await query(
    "SELECT * FROM listings WHERE apartment_id = $1 AND identity_key = $2",
    [apartmentId, identityKey],
  );
  const current = existing.rows[0];

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
    const inserted = await query(
      `INSERT INTO listings (
         apartment_id, identity_key, unit, price, bedrooms, bathrooms, sqft,
         available_date, floor_plan, listing_url, first_seen_at, last_seen_at,
         is_active, confidence, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14)
       RETURNING *`,
      [apartmentId, identityKey, ...values.slice(0, 8), firstSeen, lastSeen, values[8], values[9]],
    );
    await insertSnapshot(inserted.rows[0].id, inserted.rows[0].price, inserted.rows[0].available_date, lastSeen);
    return inserted.rows[0];
  }

  const priceChanged = (current.price ?? null) !== (values[1] ?? null);
  const dateChanged = (current.available_date ?? null) !== (values[5] ?? null);

  const updated = await query(
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
       confidence = $11,
       source = $12
     WHERE id = $1
     RETURNING *`,
    [current.id, ...values.slice(0, 8), lastSeen, values[8], values[9]],
  );

  if (priceChanged || dateChanged) {
    await insertSnapshot(current.id, values[1], values[5], lastSeen);
  }

  return updated.rows[0];
}

async function insertSnapshot(listingId, price, availableDate, capturedAt) {
  await query(
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
