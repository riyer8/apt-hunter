import { createMonitor } from "./monitor.js";
import { getScheduleConfig } from "./schedule.js";
import { scrapeApartment, schedulerPublicStatus, closeBrowser } from "./scraper.js";
import {
  claimScrapeLock,
  getApartmentRow,
  listApartmentRows,
  recordScrape,
  releaseScrapeLock,
  updateSchedule,
} from "./store.js";

let monitor = null;
let timer = null;

export function getMonitor() {
  if (!monitor) {
    const config = getScheduleConfig();
    monitor = createMonitor({
      listApartments: listApartmentRows,
      getApartment: getApartmentRow,
      claimLock: (id, at) => claimScrapeLock(id, at, config.lockStaleMs),
      releaseLock: releaseScrapeLock,
      recordScrape,
      updateSchedule,
      scrape: scrapeApartment,
      config,
    });
  }
  return monitor;
}

export function startScheduler() {
  const config = getScheduleConfig();
  const instance = getMonitor();
  if (!config.enabled) {
    console.log("AptWatch scheduler disabled (SCHEDULER_ENABLED=false). Scrape Now still works.");
    return instance;
  }
  if (timer) return instance;
  const tick = () => instance.tick().catch((error) => console.error("AptWatch scheduler:", error.message));
  timer = setInterval(tick, config.tickMs);
  tick();
  console.log(
    `AptWatch scheduler on: every ${Math.round(config.intervalMs / 60000)} min, tick ${Math.round(config.tickMs / 1000)}s`,
  );
  return instance;
}

export async function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  await closeBrowser();
}

export function schedulerStatus() {
  return schedulerPublicStatus();
}
