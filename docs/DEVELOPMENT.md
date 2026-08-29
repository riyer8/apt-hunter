# Development

## Run everything locally

One-time setup (macOS) so the Chrome extension can start the backend when you open it:

```bash
npm run launcher:install
```

Or keep `npm run launcher` running in a terminal during dev.

From the repo root (starts Postgres via Docker when available, then the API and dashboard):

```bash
npm install --prefix server
npm install --prefix web
npm run dev
```

Or run services separately — see [BACKEND.md](BACKEND.md).

Open http://localhost:5173/.

## Scheduled monitoring

The Chrome extension still has **Analyze** for on-demand extraction. Ongoing checks run on the **backend**, not in the browser.

Once Postgres and the API are running, AptWatch looks at apartments with `monitor_state = active` and scrapes each one on a timer.

- **Default interval:** 30 minutes (`SCRAPE_INTERVAL_MS=1800000`)
- **Start / stop:** on a building page, **Start monitoring** or **Pause monitoring**
- **Scrape now:** one extra scrape right away; does not move the next scheduled time
- **New apartments** added through the API start as active and are queued immediately

### Retries

A failed scrape keeps the last good listings. It does not mark units removed.

1. fail → wait 2 minutes, try again
2. fail → wait 8 minutes, try again
3. fail → mark the scrape failed, wait until the next 30-minute slot

If a site blocks automation (403/429/CAPTCHA), AptWatch records that error and does not try to bypass it.

Keep the API process running. Sleeping your laptop also sleeps the scheduler; a deployed host is what keeps checks going overnight.

## Building intelligence

Each building is researched **once**, then every unit reuses that Building Profile. Put `OPENAI_API_KEY` in `server/.env` (optional `OPENAI_MODEL=gpt-4o-mini`). If the key is missing, the profile is stored as skipped until you click **Re-analyze Building** on the building page.

Do not commit `.env`.

## Chrome notifications

Confirmed `SUCCESS` change events can create an in-app bell item and a Chrome notification. `REMOVED` listings do not notify. Set preferences per building on its page.

Reload the unpacked extension after updates. Keep the API running so the service worker can poll for pending alerts.

## Apartment preferences

Open **Preferences** in the dashboard. You can add more than one search (for example a studio hunt and a 2-bed hunt). A listing qualifies if it fits any of them. Scores are rule-based (no AI). Hard requirements must pass; UNKNOWN amenities are not treated as no.

## Tests

Unit tests:

```bash
cd server
npm test
```

Covers scheduling, scrape retries, change detection, matching, building profiles, and selection.

With the API running, end-to-end smoke test:

```bash
npm run smoke
```

Checks `/health`, `/wake`, apartments, listing/building selection, preferences, and changes.
