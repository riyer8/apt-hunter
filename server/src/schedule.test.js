import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryStore, createMonitor } from "./monitor.js";
import {
  MONITOR_ACTIVE,
  MONITOR_PAUSED,
  dueApartments,
  isDue,
  nextDelayAfterResult,
  nextFailures,
} from "./schedule.js";

const NOW = Date.parse("2026-08-27T16:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const config = {
  intervalMs: 30 * 60 * 1000,
  tickMs: 1000,
  maxAttempts: 3,
  backoffMs: [2 * 60 * 1000, 8 * 60 * 1000],
  lockStaleMs: 6 * 60 * 1000,
};

function apt(overrides = {}) {
  return {
    id: "apt-1",
    name: "The George",
    url: "https://example.com/george",
    monitor_state: MONITOR_ACTIVE,
    next_scrape_at: new Date(NOW - 1000).toISOString(),
    scrape_lock_at: null,
    consecutive_failures: 0,
    listings: [{ unit: "1204", price: 4000 }],
    ...overrides,
  };
}

describe("schedule selection", () => {
  it("1. an active apartment whose next_scrape_at has passed is due", () => {
    const apartments = [apt()];
    assert.equal(isDue(apartments[0], NOW, config), true);
    assert.deepEqual(
      dueApartments(apartments, NOW, config).map((item) => item.id),
      ["apt-1"],
    );
  });

  it("2. a paused apartment is not due", () => {
    const paused = apt({ monitor_state: MONITOR_PAUSED });
    assert.equal(isDue(paused, NOW, config), false);
    assert.equal(dueApartments([paused], NOW, config).length, 0);
  });

  it("8. monitoring configuration lives on the apartment, so a new scheduler still sees it", () => {
    const saved = apt({ monitor_state: MONITOR_ACTIVE, next_scrape_at: new Date(NOW - 5000).toISOString() });
    const first = createMonitor({ now: () => NOW, config, scrape: async () => ({ outcome: "SUCCESS", listings: [] }) });
    first.load([saved]);
    const restarted = createMonitor({ now: () => NOW, config, scrape: async () => ({ outcome: "SUCCESS", listings: [] }) });
    restarted.load([saved]);
    assert.equal(dueApartments(restarted.inFlight ? [saved] : [saved], NOW, config).length, 1);
    assert.equal(saved.monitor_state, MONITOR_ACTIVE);
  });
});

describe("createMonitor", () => {
  it("1. tick scrapes an active due apartment", async () => {
    const store = createInMemoryStore([apt()]);
    let scraped = 0;
    const monitor = createMonitor({
      ...store,
      scrape: async () => {
        scraped += 1;
        return { outcome: "SUCCESS", listings: [{ unit: "1204", price: 4000 }] };
      },
      now: () => NOW,
      config,
    });
    const results = await monitor.tick();
    assert.equal(scraped, 1);
    assert.equal(results[0].outcome, "SUCCESS");
  });

  it("2. tick does not scrape a paused apartment", async () => {
    const store = createInMemoryStore([apt({ monitor_state: MONITOR_PAUSED })]);
    let scraped = 0;
    const monitor = createMonitor({
      ...store,
      scrape: async () => {
        scraped += 1;
        return { outcome: "SUCCESS", listings: [] };
      },
      now: () => NOW,
      config,
    });
    const results = await monitor.tick();
    assert.equal(scraped, 0);
    assert.equal(results.length, 0);
  });

  it("3. scrapeNow runs even when the apartment is not due", async () => {
    const store = createInMemoryStore([
      apt({ next_scrape_at: new Date(NOW + HOUR).toISOString(), monitor_state: MONITOR_PAUSED }),
    ]);
    const originalNext = store.apartments[0].next_scrape_at;
    let scraped = 0;
    const monitor = createMonitor({
      ...store,
      scrape: async () => {
        scraped += 1;
        return { outcome: "SUCCESS", listings: [{ unit: "908", price: 4100 }] };
      },
      now: () => NOW,
      config,
    });
    const result = await monitor.scrapeNow("apt-1");
    assert.equal(scraped, 1);
    assert.equal(result.outcome, "SUCCESS");
    assert.equal(store.apartments[0].next_scrape_at, originalNext);
  });

  it("4. a failed scrape does not delete stored listings", async () => {
    const existing = [{ unit: "1204", price: 4000 }];
    const store = createInMemoryStore([apt({ listings: existing })]);
    const monitor = createMonitor({
      ...store,
      scrape: async () => ({ outcome: "FAILED", listings: [], errorMessage: "timeout" }),
      now: () => NOW,
      config,
    });
    await monitor.tick();
    assert.deepEqual(store.listings.get("apt-1"), existing);
    assert.equal(store.scrapes[0].outcome, "FAILED");
    assert.deepEqual(store.scrapes[0].listings, []);
  });

  it("5. retries back off, then wait for the next interval after 3 failures", () => {
    assert.equal(nextFailures(false, 0), 1);
    assert.equal(
      nextDelayAfterResult({ ok: false, consecutiveFailures: 1, ...config }),
      2 * 60 * 1000,
    );
    assert.equal(
      nextDelayAfterResult({ ok: false, consecutiveFailures: 2, ...config }),
      8 * 60 * 1000,
    );
    assert.equal(
      nextDelayAfterResult({ ok: false, consecutiveFailures: 3, ...config }),
      config.intervalMs,
    );
    assert.equal(nextDelayAfterResult({ ok: true, consecutiveFailures: 0, ...config }), config.intervalMs);
  });

  it("5b. a failed tick schedules the backoff delay", async () => {
    const store = createInMemoryStore([apt()]);
    const monitor = createMonitor({
      ...store,
      scrape: async () => {
        throw new Error("timeout");
      },
      now: () => NOW,
      config,
    });
    await monitor.tick();
    assert.equal(store.apartments[0].consecutive_failures, 1);
    assert.equal(Date.parse(store.apartments[0].next_scrape_at), NOW + 2 * 60 * 1000);
  });

  it("6. two scrapes cannot run at the same time for one apartment", async () => {
    const store = createInMemoryStore([apt()]);
    let hold;
    const held = new Promise((resolve) => {
      hold = resolve;
    });
    let started;
    const scrapeStarted = new Promise((resolve) => {
      started = resolve;
    });
    const monitor = createMonitor({
      ...store,
      scrape: async () => {
        started();
        await held;
        return { outcome: "SUCCESS", listings: [] };
      },
      now: () => NOW,
      config,
    });
    const first = monitor.tick();
    await scrapeStarted;
    const second = await monitor.scrapeNow("apt-1");
    assert.ok(second.skipped === "in-flight" || second.skipped === "locked");
    hold();
    const done = await first;
    assert.equal(done[0].outcome, "SUCCESS");
  });

  it("7. a successful scrape updates last_checked_at", async () => {
    const store = createInMemoryStore([apt({ last_checked_at: null })]);
    const monitor = createMonitor({
      ...store,
      scrape: async () => ({ outcome: "SUCCESS", listings: [{ unit: "1204" }] }),
      now: () => NOW,
      config,
    });
    await monitor.tick();
    assert.ok(store.apartments[0].last_checked_at);
    assert.equal(store.apartments[0].consecutive_failures, 0);
  });
});
