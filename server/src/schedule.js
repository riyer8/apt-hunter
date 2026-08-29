export const MONITOR_ACTIVE = "active";
export const MONITOR_PAUSED = "paused";

export function getScheduleConfig(env = process.env) {
  const intervalMs = positiveNumber(env.SCRAPE_INTERVAL_MS, 60 * 60 * 1000);
  const tickMs = positiveNumber(env.SCHEDULER_TICK_MS, 15 * 1000);
  const maxAttempts = positiveNumber(env.SCRAPE_MAX_ATTEMPTS, 3);
  const backoffMs = String(env.SCRAPE_RETRY_BACKOFF_MS || "120000,480000")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    intervalMs,
    tickMs,
    maxAttempts,
    backoffMs: backoffMs.length ? backoffMs : [2 * 60 * 1000, 8 * 60 * 1000],
    lockStaleMs: positiveNumber(env.SCRAPE_LOCK_STALE_MS, 6 * 60 * 1000),
    minApartmentGapMs: positiveNumber(env.SCRAPE_MIN_GAP_MS, 10 * 1000),
    enabled: env.SCHEDULER_ENABLED !== "false",
  };
}

export function monitorStateOf(apartment) {
  return apartment?.monitorState || apartment?.monitor_state || MONITOR_PAUSED;
}

export function isLocked(apartment, now = Date.now(), staleMs = getScheduleConfig().lockStaleMs) {
  const lock = apartment?.scrapeLockAt || apartment?.scrape_lock_at;
  if (!lock) return false;
  const at = toMs(lock);
  if (at == null) return false;
  return now - at < staleMs;
}

export function isDue(apartment, now = Date.now(), config = getScheduleConfig()) {
  if (monitorStateOf(apartment) !== MONITOR_ACTIVE) return false;
  if (isLocked(apartment, now, config.lockStaleMs)) return false;
  const next = apartment?.nextScrapeAt || apartment?.next_scrape_at;
  if (!next) return true;
  const at = toMs(next);
  return at == null || at <= now;
}

export function dueApartments(apartments, now = Date.now(), config = getScheduleConfig()) {
  return (apartments || []).filter((apartment) => isDue(apartment, now, config));
}

export function nextDelayAfterResult({
  ok,
  consecutiveFailures,
  maxAttempts = getScheduleConfig().maxAttempts,
  intervalMs = getScheduleConfig().intervalMs,
  backoffMs = getScheduleConfig().backoffMs,
}) {
  if (ok) return intervalMs;
  if (consecutiveFailures < maxAttempts) {
    return backoffMs[Math.min(Math.max(consecutiveFailures, 1) - 1, backoffMs.length - 1)];
  }
  return intervalMs;
}

export function nextFailures(ok, previousFailures = 0) {
  return ok ? 0 : Number(previousFailures || 0) + 1;
}

export function canClaimLock(apartment, now = Date.now(), staleMs = getScheduleConfig().lockStaleMs) {
  return !isLocked(apartment, now, staleMs);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
