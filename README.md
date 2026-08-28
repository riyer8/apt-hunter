# AptWatch

a chrome extension that pulls unit listings off apartment availability pages. early MVP, not meant to be serious!

## How to use it

chrome://extensions → Developer mode → Load unpacked → this folder
click AptWatch → add a name and URL → Analyze
Dashboard in the popup opens the website. Backend setup: see `docs/BACKEND.md`.

## Scheduled monitoring

The Chrome extension still has Analyze for on-demand extraction. Ongoing checks run on the **backend**, not in the browser.

Once Postgres and the API are running (`cd server && npm run dev`), AptWatch looks at apartments with `monitor_state = active` and scrapes each one on a timer.

- **Default interval:** 30 minutes (`SCRAPE_INTERVAL_MS=1800000`)
- **Scheduler:** a loop inside the Node API process. Due jobs and locks live in Postgres, so restarting the API does not forget which buildings are monitored.
- **Start / stop:** on an apartment page, **Start monitoring** or **Pause monitoring**. Paused buildings are skipped.
- **Scrape now:** one extra scrape right away. It does not move the next scheduled time.
- **New apartments** added through the API start as active and are queued immediately.

### Retries

A failed scrape keeps the last good listings. It does not mark units removed.

1. fail → wait 2 minutes, try again
2. fail → wait 8 minutes, try again
3. fail → mark the scrape failed, wait until the next 30-minute slot

It does not retry forever. The next interval starts a fresh cycle. If a site blocks automation (403/429/CAPTCHA), AptWatch records that error and does not try to bypass it.

### Run the scheduler locally

```bash
cd server
cp .env.example .env   # first time
npm install
npx playwright install chromium   # if Chrome is not installed
npm run seed
npm run reset          # wipe all data for a fresh start (no demo buildings)
npm run dev
```

Keep that process running. Sleeping your laptop also sleeps the scheduler; a deployed host is what keeps checks going overnight.

Then open http://localhost:5173/, start monitoring on a building, or click **Scrape now**. Watch **Scrape history** on the apartment page.

### Test scheduled scraping

```bash
cd server
npm test
```

That covers due vs paused, Scrape now, overlap locks, retries, failed-scrape listing protection, `last_checked_at`, and restart-safe config.

To watch a live scrape: **Scrape now** on a building whose availability URL loads in a normal browser. Check `GET /apartments/:id/scrape-history` or the apartment page.

## Building intelligence

Each building is researched **once**, then every unit reuses that Building Profile. New listings, price changes, and scrapes do not call the AI again.

Put `OPENAI_API_KEY` in `server/.env` (optional `OPENAI_MODEL=gpt-4o-mini`). If the key is missing, the profile is stored as skipped until you click **Re-analyze Building** on the building page.

```bash
# server/.env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Do not commit `.env`. Seed data for The George and Avalon Dogpatch includes a demo profile so the dashboard works before you add a key.

## Chrome notifications

Confirmed `SUCCESS` change events can create an in-app bell item and a Chrome notification. REMOVED listings do not notify. Set preferences per building on its page.

Reload the unpacked extension after this update (it now uses the `notifications` and `alarms` permissions). Keep the API running so the service worker can poll for pending alerts.

## Apartment preferences

Open **Preferences** in the dashboard. You can add more than one search (for example a studio hunt and a 2-bed hunt). A listing qualifies if it fits any of them. Scores are rule-based (no AI). Hard requirements must pass; UNKNOWN amenities are not treated as no.

```bash
cd server
npm test
```
