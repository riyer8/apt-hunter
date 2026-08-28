import { migrate, pool, query } from "./db.js";
import { decideNotification } from "./notify.js";
import { demoAvalonProfile, demoGeorgeProfile } from "../../shared/demoBuildingProfiles.js";
import { saveBuildingProfile } from "./buildingAnalyze.js";

const GEORGE_ID = "11111111-1111-4111-8111-111111111111";
const AVALON_ID = "22222222-2222-4222-8222-222222222222";

await migrate();

await query("DELETE FROM apartments WHERE id = ANY($1::uuid[])", [[GEORGE_ID, AVALON_ID]]);

await query(
  `INSERT INTO apartments (id, name, source_url, canonical_url, location, monitoring_status, last_checked_at, created_at, monitor_state, next_scrape_at)
   VALUES
     ($1, 'The George', 'https://www.equityapartments.com/san-francisco/soma/the-george-apartments',
      'https://www.equityapartments.com/san-francisco/soma/the-george-apartments', 'SoMa, San Francisco',
      'success', now() - interval '8 minutes', now() - interval '12 days', 'active', now() + interval '30 minutes'),
     ($2, 'Avalon Dogpatch', 'https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/',
      'https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch', 'Dogpatch, San Francisco',
      'success', now() - interval '22 minutes', now() - interval '4 days', 'active', now() + interval '30 minutes')`,
  [GEORGE_ID, AVALON_ID],
);

await query(
  `UPDATE apartments SET features = $2::jsonb WHERE id = $1`,
  [
    GEORGE_ID,
    JSON.stringify({ gym: "YES", elevator: "YES", pool: "NO", parking: "UNKNOWN", laundry: "UNKNOWN" }),
  ],
);
await query(
  `UPDATE apartments SET features = $2::jsonb WHERE id = $1`,
  [
    AVALON_ID,
    JSON.stringify({ gym: "YES", elevator: "YES", pool: "YES", parking: "YES", laundry: "UNKNOWN" }),
  ],
);

await query("DELETE FROM preference_profiles");
await query(
  `INSERT INTO preference_profiles (
     name, sort_order, max_rent, bedrooms, min_bathrooms, min_sqft, move_in_latest,
     preferred_features, preferred_neighborhoods, hard
   ) VALUES
     ('Studio', 0, 4000, '[0]'::jsonb, 1, 400, '2026-10-31',
      '["laundry","gym"]'::jsonb, '["SoMa","Dogpatch"]'::jsonb,
      '{"maxRent":true,"bedrooms":true,"bathrooms":true,"minSqft":true,"maxSqft":false,"moveIn":true,"requiredFeatures":true,"neighborhoods":false}'::jsonb),
     ('2 bed 2 bath', 1, 5600, '[2]'::jsonb, 2, 800, '2026-10-31',
      '["laundry","parking","gym"]'::jsonb, '["SoMa","Dogpatch"]'::jsonb,
      '{"maxRent":true,"bedrooms":true,"bathrooms":true,"minSqft":true,"maxSqft":false,"moveIn":true,"requiredFeatures":true,"neighborhoods":false}'::jsonb)`,
);
await query(
  `INSERT INTO user_settings (id, match_alerts) VALUES ('default', false)
   ON CONFLICT (id) DO UPDATE SET match_alerts = false, updated_at = now()`,
);

const georgeUnits = [
  {
    identity: "unit:1204",
    unit: "1204",
    price: 3995,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 620,
    available: "2026-09-20",
    plan: "A1",
    first: "3 hours",
    url: "https://www.equityapartments.com/san-francisco/soma/the-george-apartments/unit/1204",
  },
  {
    identity: "unit:908",
    unit: "908",
    price: 4125,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 648,
    available: "2026-09-08",
    plan: "A2",
    first: "6 days",
    url: "https://www.equityapartments.com/san-francisco/soma/the-george-apartments/unit/908",
    previousPrice: 4295,
  },
  {
    identity: "unit:1412",
    unit: "1412",
    price: 5290,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 910,
    available: "now",
    plan: "B4",
    first: "2 hours",
    url: "https://www.equityapartments.com/san-francisco/soma/the-george-apartments/unit/1412",
  },
  {
    identity: "unit:404",
    unit: "404",
    price: 3595,
    bedrooms: 0,
    bathrooms: 1,
    sqft: 472,
    available: "now",
    plan: "S1",
    first: "5 days",
    url: "https://www.equityapartments.com/san-francisco/soma/the-george-apartments/unit/404",
  },
  {
    identity: "unit:707",
    unit: "707",
    price: 3895,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 588,
    available: "2026-08-30",
    plan: "A1",
    first: "11 days",
    url: "https://www.equityapartments.com/san-francisco/soma/the-george-apartments/unit/707",
    active: false,
  },
];

const avalonUnits = [
  {
    identity: "unit:00b-143",
    unit: "00B-143",
    price: 3955,
    bedrooms: 0,
    bathrooms: 1,
    sqft: 482,
    available: "2026-10-02",
    plan: "S3-482SF",
    first: "1 hour",
    url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00B-143",
  },
  {
    identity: "unit:00b-368",
    unit: "00B-368",
    price: 3980,
    bedrooms: 0,
    bathrooms: 1,
    sqft: 436,
    available: "2026-08-28",
    plan: "S2-436SF",
    first: "2 days",
    url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00B-368",
  },
  {
    identity: "unit:00c-175",
    unit: "00C-175",
    price: 4240,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 545,
    available: "2026-09-27",
    plan: "A1-545SF",
    first: "3 days",
    url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00C-175",
    previousPrice: 4410,
  },
];

async function insertUnits(apartmentId, units) {
  for (const unit of units) {
    const inserted = await query(
      `INSERT INTO listings (
         apartment_id, identity_key, unit, price, bedrooms, bathrooms, sqft,
         available_date, floor_plan, listing_url, first_seen_at, last_seen_at,
         is_active, missing_success_count, confidence, source
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         now() - $11::interval, now() - interval '8 minutes',
         $12, $13, 'HIGH', 'json'
       ) RETURNING id, price, available_date`,
      [
        apartmentId,
        unit.identity,
        unit.unit,
        unit.price,
        unit.bedrooms,
        unit.bathrooms,
        unit.sqft,
        unit.available,
        unit.plan,
        unit.url,
        unit.first,
        unit.active !== false,
        unit.active === false ? 2 : 0,
      ],
    );
    const listing = inserted.rows[0];
    if (unit.previousPrice != null) {
      await query(
        `INSERT INTO listing_snapshots (listing_id, price, available_date, captured_at)
         VALUES ($1, $2, $3, now() - interval '4 days')`,
        [listing.id, unit.previousPrice, unit.available],
      );
    }
    await query(
      `INSERT INTO listing_snapshots (listing_id, price, available_date, captured_at)
       VALUES ($1, $2, $3, now() - interval '8 minutes')`,
      [listing.id, listing.price, listing.available_date],
    );
  }
}

await insertUnits(GEORGE_ID, georgeUnits);
await insertUnits(AVALON_ID, avalonUnits);

await query(
  `INSERT INTO alert_preferences (apartment_id) VALUES ($1), ($2)
   ON CONFLICT (apartment_id) DO NOTHING`,
  [GEORGE_ID, AVALON_ID],
);

async function seedChange(apartmentId, identity, type, previousValue, newValue, ago, details = null) {
  const listing = await query(
    "SELECT * FROM listings WHERE apartment_id = $1 AND identity_key = $2",
    [apartmentId, identity],
  );
  const change = await query(
    `INSERT INTO listing_changes (
       listing_id, apartment_id, change_type, previous_value, new_value, details, detected_at
     ) VALUES ($1, $2, $3, $4, $5, $6, now() - $7::interval)
     RETURNING *`,
    [listing.rows[0].id, apartmentId, type, previousValue, newValue, details, ago],
  );
  return { listing: listing.rows[0], change: change.rows[0] };
}

await seedChange(GEORGE_ID, "unit:1412", "NEW", null, "1412", "2 hours");
await seedChange(GEORGE_ID, "unit:1204", "NEW", null, "1204", "3 hours");
await seedChange(GEORGE_ID, "unit:908", "PRICE_DROP", "4295", "4125", "8 minutes", {
  previousPrice: 4295,
  currentPrice: 4125,
  priceChange: -170,
  priceChangePercent: -3.96,
});
await seedChange(GEORGE_ID, "unit:404", "PRICE_INCREASE", "3495", "3595", "6 days", {
  previousPrice: 3495,
  currentPrice: 3595,
  priceChange: 100,
  priceChangePercent: 2.86,
});
await seedChange(GEORGE_ID, "unit:707", "REMOVED", "707", null, "8 minutes");
await seedChange(AVALON_ID, "unit:00c-175", "PRICE_DROP", "4410", "4240", "22 minutes", {
  previousPrice: 4410,
  currentPrice: 4240,
  priceChange: -170,
  priceChangePercent: -3.85,
});
await seedChange(AVALON_ID, "unit:00b-368", "AVAILABILITY_CHANGED", "2026-09-05", "2026-08-28", "22 minutes");

const changeRows = await query(
  `SELECT c.*, a.name AS apartment_name, l.unit, l.price, l.bedrooms, l.sqft,
          l.available_date, l.listing_url, l.floor_plan
   FROM listing_changes c
   JOIN apartments a ON a.id = c.apartment_id
   JOIN listings l ON l.id = c.listing_id
   WHERE a.id = ANY($1::uuid[])`,
  [[GEORGE_ID, AVALON_ID]],
);
for (const row of changeRows.rows) {
  const decided = decideNotification({
    outcome: "SUCCESS",
    change: { id: row.id, type: row.change_type, apartmentId: row.apartment_id },
    listing: {
      id: row.listing_id,
      apartmentId: row.apartment_id,
      apartmentName: row.apartment_name,
      unit: row.unit,
      price: row.price,
      bedrooms: row.bedrooms,
      sqft: row.sqft,
      availableDate: row.available_date,
      listingUrl: row.listing_url,
      floorPlan: row.floor_plan,
    },
  });
  if (!decided.notify) continue;
  const note = decided.notification;
  await query(
    `INSERT INTO notifications (
       change_id, apartment_id, listing_id, notification_type, title, body, listing_url, click_url, created_at, delivery_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'delivered')
     ON CONFLICT (change_id) DO NOTHING`,
    [
      note.changeId,
      note.apartmentId,
      note.listingId,
      note.notificationType,
      note.title,
      note.body,
      note.listingUrl,
      note.clickUrl,
      row.detected_at,
    ],
  );
}

await query(
  `INSERT INTO scrape_runs (apartment_id, started_at, completed_at, status, extraction_method, listings_found, error_message)
   VALUES
     ($1, now() - interval '12 hours', now() - interval '12 hours', 'success', 'JSON-LD', 5, NULL),
     ($1, now() - interval '8 minutes', now() - interval '8 minutes', 'success', 'JSON-LD', 4, NULL),
     ($2, now() - interval '1 day', now() - interval '1 day', 'failed', 'none', 0, 'Timed out waiting for the availability page.'),
     ($2, now() - interval '22 minutes', now() - interval '22 minutes', 'success', 'Embedded JSON', 3, NULL)`,
  [GEORGE_ID, AVALON_ID],
);

await saveBuildingProfile(GEORGE_ID, demoGeorgeProfile(2026));
await saveBuildingProfile(AVALON_ID, demoAvalonProfile(2026));

console.log("Seeded The George and Avalon Dogpatch.");
await pool.end();
