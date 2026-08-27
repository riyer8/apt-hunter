import { migrate, pool, query } from "./db.js";

const GEORGE_ID = "11111111-1111-4111-8111-111111111111";
const AVALON_ID = "22222222-2222-4222-8222-222222222222";

await migrate();

await query("DELETE FROM apartments WHERE id = ANY($1::uuid[])", [[GEORGE_ID, AVALON_ID]]);

await query(
  `INSERT INTO apartments (id, name, source_url, canonical_url, location, monitoring_status, last_checked_at, created_at)
   VALUES
     ($1, 'The George', 'https://www.equityapartments.com/san-francisco/soma/the-george-apartments',
      'https://www.equityapartments.com/san-francisco/soma/the-george-apartments', 'SoMa, San Francisco',
      'success', now() - interval '8 minutes', now() - interval '12 days'),
     ($2, 'Avalon Dogpatch', 'https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/',
      'https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch', 'Dogpatch, San Francisco',
      'success', now() - interval '22 minutes', now() - interval '4 days')`,
  [GEORGE_ID, AVALON_ID],
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
         is_active, confidence, source
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         now() - $11::interval, now() - interval '8 minutes',
         $12, 'HIGH', 'json'
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
  `INSERT INTO scrape_runs (apartment_id, started_at, completed_at, status, extraction_method, listings_found, error_message)
   VALUES
     ($1, now() - interval '12 hours', now() - interval '12 hours', 'success', 'JSON-LD', 5, NULL),
     ($1, now() - interval '8 minutes', now() - interval '8 minutes', 'success', 'JSON-LD', 4, NULL),
     ($2, now() - interval '1 day', now() - interval '1 day', 'failed', 'none', 0, 'Timed out waiting for the availability page.'),
     ($2, now() - interval '22 minutes', now() - interval '22 minutes', 'success', 'Embedded JSON', 3, NULL)`,
  [GEORGE_ID, AVALON_ID],
);

console.log("Seeded The George and Avalon Dogpatch.");
await pool.end();
