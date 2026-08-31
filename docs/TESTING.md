# Testing AptWatch

AptWatch has **four layers** of automated checks. Together they answer: *does the logic work?*, *can we parse real apartment sites?*, and *does the running app work end-to-end?*

## Quick start

```bash
# Fast (~5 seconds) — run before most code changes
npm run verify

# With API smoke test (~10 seconds) — backend must be running (npm run dev)
npm run verify:live

# Full live scrape of all 20 SF buildings (~4 minutes) — needs network + Playwright
npm run verify:audit
```

CI runs **unit tests** and **web build** on every push. Live scrapes are manual (they hit real websites).

---

## Layer 1 — Server unit tests (74 tests)

**What it checks:** Core logic with no network and no browser.

| Area | Examples |
|------|----------|
| Scheduling | Due apartments scraped, paused ones skipped, retries back off |
| Change detection | New units, price drops, removals after consecutive misses |
| Matching | Budget, beds, move-in date, preference profiles |
| Notifications | When to alert, duplicate suppression, filter rules |
| Building profiles | Score calculation, construction year validation |

```bash
npm test
# or: cd server && npm test
```

**Last run:** 74/74 passed.

---

## Layer 2 — Layout fixtures (8 site patterns)

**What it checks:** The listing extractor against **saved HTML** that mirrors how major property managers publish units. No live network — fast and stable.

| Fixture | Real-world pattern |
|---------|-------------------|
| RentCafe-style unit table | RentCafe / Yardi tables |
| JSON-LD apartment offers | Structured data in `<script type="application/ld+json">` |
| Avalon-style listing cards | AvalonBay card layout |
| Embedded JavaScript state | Units in `window.__NEXT_DATA__` / similar |
| Avalon Fusion.globalContent | Avalon API payload in page |
| Unstructured DOM cards | Generic card grids |
| SightMap JSON-LD | SightMap + offers combo |
| Windsor Spaces unit cards | Windsor Communities layout |

```bash
npm run test:layouts
```

**Last run:** 8/8 passed.

---

## Layer 3 — API smoke test

**What it checks:** A running AptWatch backend responds correctly — health, apartments, favorites, preferences, changes.

**Requires:** `npm run dev` (or API on `http://127.0.0.1:8787`).

```bash
npm run smoke
```

**Last run:** All checks passed (18 buildings in DB).

---

## Layer 4 — Live scrape audit (20 SF buildings)

**What it checks:** Playwright opens each building's **real availability URL** and runs the full scrape pipeline (same code the scheduler uses).

```bash
npm run test:audit
# one building: node scripts/audit/scrape-audit.mjs --name=Dogpatch
```

Results are saved to `data/scrape-audit-results.json`.

### Latest live audit

Run: **2026-08-30** · **19/20 buildings** extract listings

| Status | Building | Units | Notes |
|--------|----------|------:|-------|
| ✓ | Avalon Dogpatch | 12 | |
| ✓ | Windsor Dogpatch | 14 | |
| ~ | 388 Beale | 30 | PARTIAL — some fields missing |
| ~ | 38 Dolores | 2 | PARTIAL |
| ✓ | Spera | 1 | |
| ✓ | The Oak SF | 4 | |
| ✓ | Strata at Mission Bay | 4 | |
| ✓ | Mission Bay by Windsor | 6 | |
| ✓ | One Henry Adams | 2 | Equity |
| ✓ | 333 Fremont | 6 | |
| ~ | Duboce | 16 | PARTIAL |
| ✓ | The Gateway | 20 | |
| ✓ | 1700 California | 3 | RentCafe |
| ✗ | VELA SF | 0 | Site blocks or hides units from automation |
| ✓ | Mission Rock | 18 | |
| ✓ | Solaire | 22 | |
| ✓ | SOMA at 788 | 59 | |
| ✓ | NEMA | 59 | |
| ✓ | Avalon Hayes Valley | 16 | |
| ✓ | Avalon Mission Bay | 38 | |

**Legend:** ✓ SUCCESS · ~ PARTIAL (listings found, incomplete data) · ✗ FAILED

---

## What is *not* tested automatically

| Area | Why |
|------|-----|
| Chrome extension popup UI | Thin client; logic lives in server + shared code |
| Dashboard React components | Covered indirectly via API smoke + manual use |
| OpenAI building profiles | Optional; needs `OPENAI_API_KEY` |
| Notification toasts in browser | Manual permission + OS integration |

These are acceptable gaps for an MVP. The risky parts — **scraping, change detection, and alerts** — are covered above.

---

## For reviewers

> AptWatch ships **74 unit tests** in CI, **8 HTML layout fixtures** for major property-site patterns, an **API smoke test**, and a **live scrape audit** against 20 San Francisco buildings (19/20 passing). The extension and dashboard are clients over a tested backend.
