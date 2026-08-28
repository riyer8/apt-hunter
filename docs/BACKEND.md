# AptWatch backend

PostgreSQL is the source of truth for apartments, listings, listing history, and scrape attempts. The Chrome extension can still run Analyze and write results. **Scheduled monitoring runs in the Node API** with Playwright, using the same page extractors. It does not need Chrome to stay open.

```text
API process (scheduler tick)
  due apartments (monitor_state = active, next_scrape_at <= now)
       │
       ├─ Playwright loads availability URL
       ├─ existing extractors + change detection
       └─ listings / listing_changes / scrape_runs


Website (Vite / React) ───────► GET /apartments ──────────────► PostgreSQL
```

The extension keeps `chrome.storage.local` as a fallback until the API is reachable. A failed scrape records `scrape_runs.status = failed` and does **not** delete existing listings, mark units removed, or write change events.

## Database setup

1. Start Postgres.

Docker (optional):

```bash
docker compose up -d
```

Or Homebrew:

```bash
brew services start postgresql@16
createuser -s aptwatch
createdb -O aptwatch aptwatch
psql -d postgres -c "ALTER USER aptwatch WITH PASSWORD 'aptwatch';"
```

2. Copy environment variables:

```bash
cp server/.env.example server/.env
```

`DATABASE_URL` and `PORT` are the only required variables. Do not commit `server/.env`.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `server/.env` | Postgres connection string |
| `PORT` | `server/.env` | API port, default `8787` |
| `SCRAPE_INTERVAL_MS` | `server/.env` | Time between successful scrapes, default `1800000` (30 min) |
| `SCHEDULER_TICK_MS` | `server/.env` | How often the API looks for due jobs, default `15000` |
| `SCRAPE_MAX_ATTEMPTS` | `server/.env` | Failures before waiting for the next interval, default `3` |
| `SCRAPE_RETRY_BACKOFF_MS` | `server/.env` | Backoff delays, default `120000,480000` |
| `SCHEDULER_ENABLED` | `server/.env` | Set `false` to run the API without the timer. Scrape Now still works. |
| `VITE_API_URL` | website (optional) | API origin, default `http://127.0.0.1:8787` |
| `OPENAI_API_KEY` | `server/.env` | Used once per building for Building Profile research. Leave empty to skip until you click Re-analyze. |
| `OPENAI_MODEL` | `server/.env` | Default `gpt-4o-mini` |

The frontend and extension never receive database credentials.

## Run the backend

From the repo root (Docker Postgres when available, API, and dashboard):

```bash
npm install --prefix server
npm install --prefix web
npm run dev
```

Or run the API alone:

```bash
cd server
npm install
cp .env.example .env   # first time only
npm run reset          # optional: wipe all buildings, listings, notifications, and preference searches
npm run dev
```

Health check: http://127.0.0.1:8787/health

## Run the website

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173/.

## Run the extension

1. Start Postgres and the API.
2. chrome://extensions → Developer mode → Load unpacked → this repo folder.
3. Click AptWatch → add a name and URL (writes local storage **and** `POST /apartments`).
4. Click Analyze (runs the existing scraper, then `POST /apartments/:id/scrape`).
5. Open Dashboard to see the same rows from the database.

If the API is down, add/analyze still works against `chrome.storage.local`.

## API endpoints

All JSON uses the existing dashboard listing/apartment shape (`id`, `url`, `status`, `listings[].firstSeen`, `previousPrice`, …).

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | `{ ok: true, scheduler, openai }` |
| `POST` | `/wake` | Re-run building-profile backfill and return `{ ok, scheduler, openai }`. Called automatically when the dashboard opens. |
| `POST` | `/apartments` | `{ name, url }`. Same canonical URL returns the existing row instead of inserting a duplicate. |
| `GET` | `/apartments` | All buildings with **active** listings |
| `GET` | `/apartments/:id` | One building |
| `DELETE` | `/apartments/:id` | Cascade-deletes listings, snapshots, and scrape runs |
| `GET` | `/apartments/:id/listings` | Active listings. `?includeInactive=1` includes removed units |
| `POST` | `/apartments/:id/scrape` | Body: `{ outcome: "SUCCESS"\|"PARTIAL"\|"FAILED", listings, extractionMethod, errorMessage }`. Failed outcomes do not change stored listings. |
| `POST` | `/apartments/:id/scrape-now` | Run the server scraper now. Does not change `next_scrape_at`. 409 if a scrape is already running. |
| `POST` | `/apartments/:id/monitor` | `{ state: "active" \| "paused" }` |
| `POST` | `/apartments/:id/selection` | `{ favorite?, watchlisted?, discarded? }` booleans — curate buildings without deleting |
| `POST` | `/listings/:id/selection` | Same flags for an individual unit |
| `GET` | `/apartments/:id/scrape-history` | Recent scrape attempts |
| `GET` | `/changes` | Change events. Query: `apartmentId`, `type` (`NEW` \| `PRICE_DROP` \| `PRICE_INCREASE` \| `AVAILABILITY_CHANGED` \| `REMOVED`), `limit` |
| `GET` | `/apartments/:id/changes` | Change events for one building |
| `GET` | `/apartments/:id/alerts` | Per-building Chrome alert preferences |
| `PUT` | `/apartments/:id/alerts` | Update alert types and filters |
| `GET` | `/notifications` | `{ notifications, unreadCount }`. Query: `unread=1`, `pending=1` |
| `POST` | `/notifications/read-all` | Mark all read |
| `POST` | `/notifications/:id/read` | Mark one read |
| `POST` | `/notifications/:id/deliver` | Claim a pending Chrome toast (idempotent) |
| `GET` | `/preferences` | User apartment preferences used for matching |
| `PUT` | `/preferences` | Replace apartment preferences; listing match scores recalculate |
| `POST` | `/apartments/:id/building-profile/reanalyze` | Manually rebuild the Building Profile (new `analysis_version`; previous snapshot stored) |
| `GET` | `/apartments/:id/building-profile/history` | Previous building analyses |

`POST /apartments/:id/scrape` stores results (from the extension or tests). `POST /apartments/:id/scrape-now` opens the page on the server.

Apartment payloads include `monitorState`, `nextScrapeAt`, `consecutiveFailures`, `lastError`, `lastSuccessfulScrape`, `lastAttemptAt`, `lastScrapeStatus`, `changeSummary`, and `alertPreferences`.

## Chrome notifications

Notifications are created only from **SUCCESS** scrape change events (`NEW`, `PRICE_DROP`, `PRICE_INCREASE`, `AVAILABILITY_CHANGED`). `REMOVED` and `FAILED`/`PARTIAL` scrapes never notify. Each `listing_changes.id` can create at most one row (`UNIQUE (change_id)`).

The API stores history and pending delivery. The Chrome extension (and the open dashboard, if permission is granted) claims a pending row with `POST /notifications/:id/deliver` and shows a browser toast. Email/SMS/Discord are not implemented.

## Matching

`GET /preferences` returns `{ profiles, matchAlerts }`. Each profile is a named search (studio vs 2-bed, etc.). A listing qualifies if it fits any profile; the badge uses the best score. `PUT /preferences` replaces the profile list. Turn on `matchAlerts` to put the score in new-listing Chrome notification titles.

## Building profiles

A `building_profiles` row is created the first time a building is added. The API fetches the official page, asks OpenAI for facts vs judgments, then stores scores. Later listings inherit that row. Scrapes never trigger another research pass. Click **Re-analyze Building** to write history and bump `analysis_version`.

Facts (`year_built`, amenity list, optional Walk Score) stay separate from AI scores. Building Age score is `10 − age × 0.12` from a year that actually appears in gathered source text. Overall score is a weighted average that **skips** null categories instead of treating them as zero.

## Scheduling

`monitor_state` (`active` / `paused`) is separate from `monitoring_status` (last scrape outcome). The scheduler only runs **active** apartments.

Each tick (15s) claims at most one due apartment (`next_scrape_at <= now`, no fresh `scrape_lock_at`) so two scrapes cannot overlap for the same building and the API does not stampede a bunch of sites at once.

Failed scrapes increment `consecutive_failures` and use retry backoff, then the normal interval. Listings are left alone. After a process restart, `monitor_state` and `next_scrape_at` are still in Postgres.

## Canonical URLs and listing identity

Apartment duplicates are keyed by a lowercased URL with trailing slashes stripped.

Listing duplicates are keyed by `(apartment_id, identity_key)`:

1. `unit:…` when a unit number exists
2. `url:…` from the listing URL when unit is missing
3. `plan:…` as a last resort

Price is never part of the identity, so a price change updates the same row.

On each **successful or partial** scrape, incoming units are compared to the previous stored listings:

- never-seen identity → `NEW`
- same identity, lower price → `PRICE_DROP` (with `previous_price`, `current_price`, `price_change`, `price_change_percent`)
- same identity, higher price → `PRICE_INCREASE`
- same identity, different availability date → `AVAILABILITY_CHANGED`
- identical row → no event

Removal is only considered after a **SUCCESS** scrape (not FAILED, not PARTIAL). A unit missing from one successful scrape increments `missing_success_count` but stays active. After **two consecutive successful scrapes** without that unit, it is marked `is_active = false` and a `REMOVED` event is stored.

Failed scrapes write `scrape_runs` and update apartment status only.

## Tests

```bash
cd server
npm test
```

With the API running:

```bash
npm run smoke
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for more detail.
