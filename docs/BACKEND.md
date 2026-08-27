# AptWatch backend

PostgreSQL is the source of truth for apartments, listings, listing history, and scrape attempts. The Chrome extension still runs the scraper (it needs a real browser tab). After Analyze, it writes results to this API. The website reads from the API.

```text
Extension popup
  add apartment ──────────────► POST /apartments ──► PostgreSQL
  Analyze (existing scraper)
       │
       └─ extraction results ─► POST /apartments/:id/scrape ──► listings
                                                              ► listing_snapshots
                                                              ► scrape_runs

Website (Vite / React) ───────► GET /apartments ──────────────► PostgreSQL
```

The extension keeps `chrome.storage.local` as a fallback until the API is reachable. A failed scrape records `scrape_runs.status = failed` and does **not** delete existing listings.

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
| `VITE_API_URL` | website (optional) | API origin, default `http://127.0.0.1:8787` |

The frontend and extension never receive database credentials.

## Run the backend

```bash
cd server
npm install
cp .env.example .env   # first time only
npm run seed           # first time, or to reset demo data
npm run dev
```

Health check: http://127.0.0.1:8787/health

## Seed development data

`npm run seed` in `server/` loads two buildings:

- **The George** — several units, including a NEW listing (`1204`), a price drop (`908`), and one removed unit (`707`, `is_active = false`)
- **Avalon Dogpatch** — three units, including a price drop (`00C-175`)

## Run the website

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173/. With the API running, the dashboard should say it is synced with the backend and show the seed apartments.

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
| `GET` | `/health` | `{ ok: true }` |
| `POST` | `/apartments` | `{ name, url }`. Same canonical URL returns the existing row instead of inserting a duplicate. |
| `GET` | `/apartments` | All buildings with **active** listings |
| `GET` | `/apartments/:id` | One building |
| `DELETE` | `/apartments/:id` | Cascade-deletes listings, snapshots, and scrape runs |
| `GET` | `/apartments/:id/listings` | Active listings. `?includeInactive=1` includes removed units |
| `POST` | `/apartments/:id/scrape` | Body: `{ outcome: "SUCCESS"\|"PARTIAL"\|"FAILED", listings, extractionMethod, errorMessage }`. Failed outcomes do not change stored listings. |
| `GET` | `/apartments/:id/scrape-history` | Recent scrape attempts |

`POST /apartments/:id/scrape` stores results from the extension scraper. The API does not open pages or re-run extraction.

## Canonical URLs and listing identity

Apartment duplicates are keyed by a lowercased URL with trailing slashes stripped.

Listing duplicates are keyed by `(apartment_id, identity_key)` where `identity_key` is `unit:…` or `plan:…`. A later scrape updates the same row and writes a snapshot when price or availability changes. Units missing from a successful scrape are marked `is_active = false`, not deleted.
