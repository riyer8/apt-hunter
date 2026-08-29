import {
  MONITOR_ACTIVE,
  canClaimLock,
  dueApartments,
  getScheduleConfig,
  isDue,
  monitorStateOf,
  nextDelayAfterResult,
  nextFailures,
} from "./schedule.js";

export function createMonitor({
  listApartments,
  getApartment,
  claimLock,
  releaseLock,
  recordScrape,
  updateSchedule,
  scrape,
  now = () => Date.now(),
  config = getScheduleConfig(),
} = {}) {
  const inFlight = new Set();
  const persisted = { apartments: [] };

  function currentApartments() {
    return persisted.apartments;
  }

  async function refresh() {
    if (listApartments) persisted.apartments = await listApartments();
    return persisted.apartments;
  }

  async function tick() {
    const apartments = listApartments ? await refresh() : currentApartments();
    const due = dueApartments(apartments, now(), config);
    if (!due.length) return [];
    return [await runScrape(due[0], { manual: false })];
  }

  async function scrapeNow(apartmentOrId, options = {}) {
    const apartment =
      typeof apartmentOrId === "object" && apartmentOrId
        ? apartmentOrId
        : getApartment
          ? await getApartment(apartmentOrId)
          : currentApartments().find((item) => item.id === apartmentOrId);
    if (!apartment) {
      const error = new Error("Apartment not found.");
      error.status = 404;
      throw error;
    }
    return runScrape(apartment, {
      manual: true,
      suppressNotifications: options.suppressNotifications === true,
    });
  }

  async function runScrape(apartment, { manual, suppressNotifications = false }) {
    if (!manual && monitorStateOf(apartment) !== MONITOR_ACTIVE) {
      return { skipped: "paused", apartmentId: apartment.id };
    }
    if (!manual && !isDue(apartment, now(), config)) {
      return { skipped: "not-due", apartmentId: apartment.id };
    }
    if (inFlight.has(apartment.id)) {
      return { skipped: "in-flight", apartmentId: apartment.id };
    }
    if (!canClaimLock(apartment, now(), config.lockStaleMs)) {
      return { skipped: "locked", apartmentId: apartment.id };
    }

    const claimed = claimLock ? await claimLock(apartment.id, now()) : apartment;
    if (!claimed) return { skipped: "locked", apartmentId: apartment.id };

    inFlight.add(apartment.id);
    const startedAt = new Date(now()).toISOString();
    let outcome = "FAILED";
    let errorMessage = null;
    let listings = [];
    let extractionMethod = null;

    try {
      const result = (await scrape(claimed)) || {};
      outcome = result.outcome || "FAILED";
      listings = Array.isArray(result.listings) ? result.listings : [];
      extractionMethod = result.extractionMethod || null;
      errorMessage = result.errorMessage || null;
    } catch (error) {
      outcome = "FAILED";
      errorMessage = error.message || "Scrape failed";
    }

    try {
      if (recordScrape) {
        await recordScrape(claimed, {
          outcome,
          listings: outcome === "FAILED" ? [] : listings,
          extractionMethod,
          errorMessage,
          startedAt,
          suppressNotifications,
        });
      }
    } finally {
      const ok = outcome === "SUCCESS" || outcome === "PARTIAL";
      const failures = nextFailures(ok, claimed.consecutive_failures ?? claimed.consecutiveFailures ?? 0);
      const delay = nextDelayAfterResult({
        ok,
        consecutiveFailures: failures,
        maxAttempts: config.maxAttempts,
        intervalMs: config.intervalMs,
        backoffMs: config.backoffMs,
      });
      if (updateSchedule) {
        await updateSchedule(claimed.id, {
          ok,
          consecutiveFailures: failures,
          lastError: ok ? null : errorMessage,
          nextScrapeAt: manual ? claimed.next_scrape_at || claimed.nextScrapeAt : new Date(now() + delay).toISOString(),
          keepNextScrape: manual,
        });
      }
      if (releaseLock) await releaseLock(claimed.id);
      inFlight.delete(apartment.id);
    }

    return {
      apartmentId: apartment.id,
      outcome,
      listingsFound: outcome === "FAILED" ? 0 : listings.length,
      errorMessage,
      skipped: null,
    };
  }

  return {
    tick,
    scrapeNow,
    inFlight,
    load(apartments) {
      persisted.apartments = apartments;
    },
  };
}

export function createInMemoryStore(seed = []) {
  const apartments = seed.map((item) => ({ ...item }));
  const listings = new Map(apartments.map((item) => [item.id, [...(item.listings || [])]]));
  const scrapes = [];

  return {
    apartments,
    listings,
    scrapes,
    async listApartments() {
      return apartments;
    },
    async getApartment(id) {
      return apartments.find((item) => item.id === id) || null;
    },
    async claimLock(id, at) {
      const apartment = apartments.find((item) => item.id === id);
      if (!apartment) return null;
      if (!canClaimLock(apartment, at)) return null;
      apartment.scrape_lock_at = new Date(at).toISOString();
      return { ...apartment };
    },
    async releaseLock(id) {
      const apartment = apartments.find((item) => item.id === id);
      if (apartment) apartment.scrape_lock_at = null;
    },
    async recordScrape(apartment, payload) {
      scrapes.push({ apartmentId: apartment.id, ...payload });
      if (payload.outcome === "FAILED") return;
      listings.set(apartment.id, payload.listings || []);
    },
    async updateSchedule(id, patch) {
      const apartment = apartments.find((item) => item.id === id);
      if (!apartment) return;
      apartment.consecutive_failures = patch.consecutiveFailures;
      apartment.last_error = patch.lastError;
      if (!patch.keepNextScrape) apartment.next_scrape_at = patch.nextScrapeAt;
      apartment.last_checked_at = new Date().toISOString();
    },
  };
}
