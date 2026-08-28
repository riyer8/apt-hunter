CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  monitoring_status TEXT NOT NULL DEFAULT 'not_analyzed',
  last_checked_at TIMESTAMPTZ,
  monitor_state TEXT NOT NULL DEFAULT 'paused',
  next_scrape_at TIMESTAMPTZ,
  scrape_lock_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS monitor_state TEXT NOT NULL DEFAULT 'paused';
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS next_scrape_at TIMESTAMPTZ;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS scrape_lock_at TIMESTAMPTZ;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS last_error TEXT;

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
  missing_success_count INTEGER NOT NULL DEFAULT 0,
  confidence TEXT,
  source TEXT,
  UNIQUE (apartment_id, identity_key)
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS missing_success_count INTEGER NOT NULL DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS listing_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  scrape_run_id UUID REFERENCES scrape_runs(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  details JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_apartment_id_idx ON listings (apartment_id);
CREATE INDEX IF NOT EXISTS listing_snapshots_listing_id_idx ON listing_snapshots (listing_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS scrape_runs_apartment_id_idx ON scrape_runs (apartment_id, started_at DESC);
CREATE INDEX IF NOT EXISTS listing_changes_detected_at_idx ON listing_changes (detected_at DESC);
CREATE INDEX IF NOT EXISTS listing_changes_apartment_id_idx ON listing_changes (apartment_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS alert_preferences (
  apartment_id UUID PRIMARY KEY REFERENCES apartments(id) ON DELETE CASCADE,
  new_listings BOOLEAN NOT NULL DEFAULT true,
  price_drops BOOLEAN NOT NULL DEFAULT true,
  price_increases BOOLEAN NOT NULL DEFAULT false,
  availability_changes BOOLEAN NOT NULL DEFAULT true,
  max_rent INTEGER,
  min_sqft INTEGER,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  available_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES listing_changes(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  listing_url TEXT,
  click_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  UNIQUE (change_id)
);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (read_at, created_at DESC);

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  max_rent INTEGER,
  bedrooms JSONB NOT NULL DEFAULT '[]',
  min_bathrooms NUMERIC,
  min_sqft INTEGER,
  max_sqft INTEGER,
  move_in_earliest TEXT,
  move_in_latest TEXT,
  required_features JSONB NOT NULL DEFAULT '[]',
  preferred_features JSONB NOT NULL DEFAULT '[]',
  preferred_neighborhoods JSONB NOT NULL DEFAULT '[]',
  hard JSONB NOT NULL DEFAULT '{}',
  match_alerts BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  match_alerts BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Search',
  sort_order INTEGER NOT NULL DEFAULT 0,
  max_rent INTEGER,
  bedrooms JSONB NOT NULL DEFAULT '[]',
  min_bathrooms NUMERIC,
  min_sqft INTEGER,
  max_sqft INTEGER,
  move_in_earliest TEXT,
  move_in_latest TEXT,
  required_features JSONB NOT NULL DEFAULT '[]',
  preferred_features JSONB NOT NULL DEFAULT '[]',
  preferred_neighborhoods JSONB NOT NULL DEFAULT '[]',
  hard JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO user_settings (id, match_alerts)
SELECT 'default', COALESCE(match_alerts, false)
FROM user_preferences
WHERE id = 'default'
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

INSERT INTO preference_profiles (
  name, sort_order, max_rent, bedrooms, min_bathrooms, min_sqft, max_sqft,
  move_in_earliest, move_in_latest, required_features, preferred_features,
  preferred_neighborhoods, hard
)
SELECT
  'Search 1', 0, max_rent, bedrooms, min_bathrooms, min_sqft, max_sqft,
  move_in_earliest, move_in_latest, required_features, preferred_features,
  preferred_neighborhoods, hard
FROM user_preferences
WHERE id = 'default'
  AND NOT EXISTS (SELECT 1 FROM preference_profiles);

CREATE TABLE IF NOT EXISTS building_profiles (
  apartment_id UUID PRIMARY KEY REFERENCES apartments(id) ON DELETE CASCADE,
  year_built INTEGER,
  building_age INTEGER,
  year_built_source TEXT,
  safety_score NUMERIC,
  building_age_score NUMERIC,
  walkability_score NUMERIC,
  views_sun_score NUMERIC,
  amenities_score NUMERIC,
  overall_score NUMERIC,
  overall_incomplete BOOLEAN NOT NULL DEFAULT false,
  missing_categories JSONB NOT NULL DEFAULT '[]',
  amenities JSONB NOT NULL DEFAULT '[]',
  facts JSONB NOT NULL DEFAULT '{}',
  judgments JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  evidence JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  analyzed_at TIMESTAMPTZ,
  analysis_version INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS building_profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  analysis_version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS building_profile_history_apartment_idx
  ON building_profile_history (apartment_id, analysis_version DESC);
