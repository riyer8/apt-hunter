import { STATUS } from "@shared/schema.js";

export function monitorMeta(apartment, { scraping = false } = {}) {
  if (scraping || apartment?.scrapeInProgress) {
    return { label: "Scraping…", tone: "warn", icon: "◌" };
  }
  if (apartment?.monitorState === "paused" || !apartment?.monitorState) {
    return { label: "Paused", tone: "muted", icon: "○" };
  }
  if ((apartment.consecutiveFailures || 0) >= 3) {
    return { label: "Scrape failing", tone: "bad", icon: "🔴" };
  }
  if ((apartment.consecutiveFailures || 0) > 0 || apartment.lastScrapeStatus === "failed") {
    return { label: "Retrying", tone: "warn", icon: "🟡" };
  }
  if (apartment.monitorState === "active") {
    return { label: "Monitoring", tone: "good", icon: "🟢" };
  }
  return { label: "Paused", tone: "muted", icon: "○" };
}

export function changeCount(apartment) {
  const summary = apartment?.changeSummary;
  if (!summary) return 0;
  return (summary.new || 0) + (summary.priceDrops || 0) + (summary.availabilityChanged || 0) + (summary.removed || 0);
}

export function scrapeStatusMeta(status) {
  switch (status) {
    case "success":
    case STATUS.SUCCESS:
      return { label: "Success", tone: "good", icon: "●" };
    case "partial":
    case STATUS.PARTIAL:
      return { label: "Partial", tone: "warn", icon: "●" };
    case "failed":
    case STATUS.FAILED:
      return { label: "Failed", tone: "bad", icon: "●" };
    case "analyzing":
    case STATUS.ANALYZING:
      return { label: "Checking", tone: "warn", icon: "●" };
    default:
      return null;
  }
}

export function statusMeta(status) {
  switch (status) {
    case STATUS.SUCCESS:
      return { label: "Monitoring", tone: "good", icon: "●" };
    case STATUS.PARTIAL:
      return { label: "Partial", tone: "warn", icon: "●" };
    case STATUS.FAILED:
      return { label: "Couldn’t read page", tone: "bad", icon: "●" };
    case STATUS.ANALYZING:
      return { label: "Checking", tone: "warn", icon: "●" };
    default:
      return { label: "Waiting for first check", tone: "muted", icon: "○" };
  }
}
