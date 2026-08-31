import { apiAvailable, apiListChanges, ensureBackendReady } from "../lib/backend.js";
import { syncFromBackend } from "../lib/storage.js";

const DASHBOARD_LOCAL = "http://localhost:5173/";

const dashboardButton = document.getElementById("dashboard-button");
const refreshButton = document.getElementById("refresh-button");
const backendStatus = document.getElementById("backend-status");
const changesLoading = document.getElementById("changes-loading");
const changesError = document.getElementById("changes-error");
const changesEmpty = document.getElementById("changes-empty");
const changesList = document.getElementById("changes-list");

const CHANGE_LABELS = {
  NEW: "New",
  PRICE_DROP: "Price drop",
  PRICE_INCREASE: "Price increase",
  AVAILABILITY_CHANGED: "Availability",
  REMOVED: "Removed",
};

dashboardButton.addEventListener("click", openDashboard);
refreshButton.addEventListener("click", () => loadChanges());

function setBackendStatus(state, message) {
  if (!backendStatus) return;
  backendStatus.hidden = state === "hidden";
  backendStatus.dataset.state = state;
  backendStatus.textContent = message;
}

async function connectBackend() {
  setBackendStatus("starting", "Starting backend…");
  const result = await ensureBackendReady();
  if (result === "ready") {
    setBackendStatus("ready", "Backend connected");
    window.setTimeout(() => setBackendStatus("hidden"), 2000);
    return true;
  }
  if (result === "timeout") {
    setBackendStatus("error", "Backend is still starting — try Refresh in a moment.");
    return false;
  }
  setBackendStatus(
    "error",
    "Run npm run launcher:install once (or npm run launcher) so AptWatch can start the backend.",
  );
  return false;
}

async function resolveDashboardUrl() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(DASHBOARD_LOCAL, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return DASHBOARD_LOCAL;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return DASHBOARD_LOCAL;
}

async function openDashboard() {
  dashboardButton.disabled = true;
  const label = dashboardButton.textContent;
  dashboardButton.textContent = "Starting…";
  try {
    await ensureBackendReady({ maxWaitMs: 60000 });
    chrome.tabs.create({ url: await resolveDashboardUrl() });
  } finally {
    dashboardButton.disabled = false;
    dashboardButton.textContent = label;
  }
}

function dashboardPath(change) {
  const unit = change.unit ? `?unit=${encodeURIComponent(change.unit)}` : "";
  return `${DASHBOARD_LOCAL}apartments/${change.apartmentId}${unit}`;
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `$${number.toLocaleString("en-US")}`;
}

function formatChangeDetail(change) {
  if (change.changeType === "PRICE_DROP" || change.changeType === "PRICE_INCREASE") {
    const details = change.details || {};
    const previous = formatPrice(details.previousPrice ?? change.previousValue);
    const current = formatPrice(details.currentPrice ?? change.newValue);
    return `${previous} → ${current}`;
  }
  if (change.changeType === "AVAILABILITY_CHANGED") {
    return `${change.previousValue || "—"} → ${change.newValue || "—"}`;
  }
  if (change.changeType === "NEW") {
    return change.unit ? `Unit ${change.unit}` : "New listing";
  }
  if (change.changeType === "REMOVED") {
    return change.unit ? `Unit ${change.unit} gone` : "No longer listed";
  }
  return change.unit ? `Unit ${change.unit}` : "Changed";
}

function renderChange(change) {
  const item = document.createElement("li");
  item.className = `change-item change-${String(change.changeType || "").toLowerCase()}`;

  const main = document.createElement("button");
  main.type = "button";
  main.className = "change-main";
  main.addEventListener("click", () => {
    chrome.tabs.create({ url: dashboardPath(change) });
  });

  const type = document.createElement("span");
  type.className = "change-type";
  type.textContent = CHANGE_LABELS[change.changeType] || change.changeType || "Change";

  const title = document.createElement("span");
  title.className = "change-title";
  title.textContent = `${change.apartmentName || "Building"}${change.unit ? ` · ${change.unit}` : ""}`;

  const detail = document.createElement("span");
  detail.className = "change-detail";
  detail.textContent = formatChangeDetail(change);

  const when = document.createElement("span");
  when.className = "change-when";
  when.textContent = formatRelativeTime(change.detectedAt);

  main.append(type, title, detail, when);
  item.append(main);

  if (change.listingUrl) {
    const external = document.createElement("button");
    external.type = "button";
    external.className = "change-external";
    external.title = "Open listing website";
    external.setAttribute("aria-label", "Open listing website");
    external.textContent = "↗";
    external.addEventListener("click", (event) => {
      event.stopPropagation();
      chrome.tabs.create({ url: change.listingUrl });
    });
    item.append(external);
  }

  return item;
}

function setLoading(loading) {
  changesLoading.hidden = !loading;
  refreshButton.disabled = loading;
}

function showError(message) {
  changesError.hidden = false;
  changesError.textContent = message;
}

function hideError() {
  changesError.hidden = true;
  changesError.textContent = "";
}

async function loadChanges() {
  hideError();
  changesEmpty.hidden = true;
  changesList.hidden = true;
  changesList.replaceChildren();
  setLoading(true);

  try {
    if (!(await apiAvailable())) {
      showError("Backend offline — open Dashboard or run npm run launcher.");
      return;
    }

    const changes = await apiListChanges({ limit: 30 });
    if (!changes.length) {
      changesEmpty.hidden = false;
      return;
    }

    for (const change of changes) {
      changesList.append(renderChange(change));
    }
    changesList.hidden = false;
  } catch (error) {
    showError(error.message || "Could not load changes.");
  } finally {
    setLoading(false);
  }
}

async function init() {
  await connectBackend();
  await syncFromBackend().catch(() => {});
  await loadChanges();
}

init();
