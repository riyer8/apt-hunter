CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  monitoring_status TEXT NOT NULL DEFAULT 'not_analyzed',
  last_checked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  identity_key TEXT NOT NULL,
  unit TEXT,
  price INTEGER,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  sqft INTEGER,
  available_date TEXT,
  floor_plan TEXT,
  listing_url TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  confidence TEXT,
  source TEXT,
  UNIQUE (apartment_id, identity_key)
);

CREATE TABLE IF NOT EXISTS listing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price INTEGER,
  available_date TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  extraction_method TEXT,
  listings_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS listings_apartment_id_idx ON listings (apartment_id);
CREATE INDEX IF NOT EXISTS listing_snapshots_listing_id_idx ON listing_snapshots (listing_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS scrape_runs_apartment_id_idx ON scrape_runs (apartment_id, started_at DESC);
