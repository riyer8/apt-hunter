import { listingMatchesFilters, sortListings } from "../shared/listingView.js";
import {
  addApartment,
  clearLastTestExtraction,
  displayName,
  getApartments,
  getDiagnosticsMode,
  getLastTestExtraction,
  getUiPrefs,
  isDuplicateUrl,
  isValidHttpUrl,
  removeApartment,
  saveUiPrefs,
  setDiagnosticsMode,
  syncFromBackend,
} from "../lib/storage.js";
import { ensureBackendReady } from "../lib/backend.js";

const form = document.getElementById("add-form");
const nameInput = document.getElementById("name-input");
const urlInput = document.getElementById("url-input");
const formError = document.getElementById("form-error");
const emptyState = document.getElementById("empty-state");
const apartmentList = document.getElementById("apartment-list");
const dashboardButton = document.getElementById("dashboard-button");
const diagnosticsToggle = document.getElementById("diagnostics-toggle");
const testToggle = document.getElementById("test-toggle");
const testPanel = document.getElementById("test-extract");
const testUrlInput = document.getElementById("test-url-input");
const testButton = document.getElementById("test-extract-button");
const clearTestButton = document.getElementById("clear-test-button");
const testError = document.getElementById("test-error");
const testReport = document.getElementById("test-report");
const backendStatus = document.getElementById("backend-status");

const DASHBOARD_LOCAL = "http://localhost:5173/";
const listingsByApartment = new Map();

let diagnosticsMode = false;
let tablePrefs = {};

function defaultTableState() {
  return { sortKey: "unit", sortDir: "asc", query: "", maxRent: "", bedrooms: "" };
}

function getTableState(id) {
  return { ...defaultTableState(), ...(tablePrefs.tables?.[id] || {}) };
}

function patchTableState(id, patch) {
  const next = { ...getTableState(id), ...patch };
  tablePrefs = { ...tablePrefs, tables: { ...(tablePrefs.tables || {}), [id]: next } };
  saveUiPrefs({ tables: tablePrefs.tables });
  return next;
}

function visibleListings(id, listings) {
  const state = getTableState(id);
  const filtered = (listings || []).filter((listing) =>
    listingMatchesFilters(listing, {
      query: state.query,
      maxRent: state.maxRent,
      bedrooms: state.bedrooms,
      minSqft: "",
      maxSqft: "",
      bathrooms: "",
      availableBy: "",
      newOnly: false,
      priceDropsOnly: false,
    }),
  );
  return sortListings(filtered, state.sortKey, state.sortDir);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name) {
    showError("Enter an apartment name.");
    return;
  }

  if (!isValidHttpUrl(url)) {
    showError("Enter a valid http:// or https:// URL.");
    return;
  }

  const apartments = await getApartments();
  if (isDuplicateUrl(apartments, url)) {
    showError("This URL is already being monitored.");
    return;
  }

  hideError();
  await addApartment({ name, url });
  nameInput.value = "";
  urlInput.value = "";
  nameInput.focus();
  await renderApartments();
});

apartmentList.addEventListener("click", async (event) => {
  const sortButton = event.target.closest("[data-sort-key]");
  if (sortButton) {
    const item = sortButton.closest("[data-apartment-id]");
    const id = item.dataset.apartmentId;
    const key = sortButton.dataset.sortKey;
    const current = getTableState(id);
    const sortDir = current.sortKey === key && current.sortDir === "asc" ? "desc" : "asc";
    patchTableState(id, { sortKey: key, sortDir });
    refreshApartmentTable(item);
    return;
  }

  const removeButton = event.target.closest("[data-remove-id]");
  if (removeButton) {
    await removeApartment(removeButton.dataset.removeId);
    await renderApartments();
    return;
  }

  const analyzeButton = event.target.closest("[data-analyze-id]");
  if (!analyzeButton) return;

  analyzeButton.disabled = true;
  chrome.runtime.sendMessage({
    type: "ANALYZE_APARTMENT",
    id: analyzeButton.dataset.analyzeId,
    url: analyzeButton.dataset.analyzeUrl,
  });
});

apartmentList.addEventListener("input", (event) => {
  const field = event.target.closest("[data-filter]");
  if (!field) return;
  const item = field.closest("[data-apartment-id]");
  patchTableState(item.dataset.apartmentId, { [field.dataset.filter]: field.value });
  refreshApartmentTable(item);
});

apartmentList.addEventListener("change", (event) => {
  const field = event.target.closest("[data-filter]");
  if (!field) return;
  const item = field.closest("[data-apartment-id]");
  patchTableState(item.dataset.apartmentId, { [field.dataset.filter]: field.value });
  refreshApartmentTable(item);
});

dashboardButton.addEventListener("click", async () => {
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
});

diagnosticsToggle.addEventListener("change", async () => {
  diagnosticsMode = diagnosticsToggle.checked;
  await setDiagnosticsMode(diagnosticsMode);
  document.body.classList.toggle("diagnostics-on", diagnosticsMode);
  await renderApartments();
  await renderTestReport();
});

testToggle.addEventListener("click", () => {
  setTestPanelOpen(testPanel.hidden);
  if (!testPanel.hidden) testUrlInput.focus();
});

testButton.addEventListener("click", async () => {
  const url = testUrlInput.value.trim();
  if (!isValidHttpUrl(url)) {
    testError.hidden = false;
    testError.textContent = "Enter a valid http:// or https:// URL.";
    return;
  }

  testError.hidden = true;
  testButton.disabled = true;
  testButton.textContent = "Testing…";
  chrome.runtime.sendMessage({ type: "TEST_EXTRACTION", url }, () => {
    testButton.disabled = false;
    testButton.textContent = "Run";
  });
});

clearTestButton.addEventListener("click", async () => {
  await clearLastTestExtraction();
  testReport.replaceChildren();
  clearTestButton.hidden = true;
});

testReport.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-report]");
  if (!copyButton) return;
  const report = await getLastTestExtraction();
  if (report?.summaryText) {
    await navigator.clipboard.writeText(report.summaryText);
    copyButton.textContent = "Copied";
    setTimeout(() => {
      copyButton.textContent = "Copy report";
    }, 1200);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.apartments) renderApartments();
  if (changes.lastTestExtraction) renderTestReport({ reveal: true });
});

function showError(message) {
  formError.hidden = false;
  formError.textContent = message;
}

function hideError() {
  formError.hidden = true;
  formError.textContent = "";
}

function formatAddedDate(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toLocaleString("en-US")}`;
}

function formatBedsBaths(listing) {
  const beds = listing.bedrooms == null ? "—" : listing.bedrooms === 0 ? "Studio" : String(listing.bedrooms);
  const baths = listing.bathrooms == null ? "—" : String(listing.bathrooms);
  if (listing.bedrooms == null && listing.bathrooms == null) return "—";
  return `${beds} / ${baths}`;
}

function formatAvailable(value) {
  if (value == null) return "—";
  if (value === "now") return "Now";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
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
      // Vite may still be starting after the API comes up.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return DASHBOARD_LOCAL;
}

function sortHeader(key, label, state, numeric) {
  const active = state.sortKey === key;
  const aria = active ? (state.sortDir === "desc" ? "descending" : "ascending") : "none";
  const mark = active ? (state.sortDir === "desc" ? " ↓" : " ↑") : "";
  const className = `${numeric ? "num " : ""}sortable`;
  return `<th class="${className}" data-sort-key="${key}" aria-sort="${aria}"><button type="button" data-label="${label}">${label}${mark}</button></th>`;
}

function fillListingRows(body, listings) {
  body.replaceChildren();
  for (const listing of listings) {
    const row = document.createElement("tr");
    row.dataset.confidence = listing.confidence || "LOW";

    const unitCell = document.createElement("td");
    if (listing.listingUrl) {
      const link = document.createElement("a");
      link.href = listing.listingUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = listing.unit || listing.floorPlan || "View";
      unitCell.append(link);
    } else {
      unitCell.textContent = listing.unit || listing.floorPlan || "—";
    }

    const price = document.createElement("td");
    price.className = "num";
    price.textContent = formatPrice(listing.price);

    const beds = document.createElement("td");
    beds.className = "num";
    beds.textContent = formatBedsBaths(listing);

    const sqft = document.createElement("td");
    sqft.className = "num";
    sqft.textContent = listing.sqft == null ? "—" : String(listing.sqft);

    const available = document.createElement("td");
    available.textContent = formatAvailable(listing.availableDate);

    row.append(unitCell, price, beds, sqft, available);
    body.append(row);
  }
}

function refreshApartmentTable(item) {
  const id = item.dataset.apartmentId;
  const listings = listingsByApartment.get(id) || [];
  const rows = visibleListings(id, listings);
  const state = getTableState(id);
  const body = item.querySelector("tbody");
  if (body) fillListingRows(body, rows);
  const meta = item.querySelector(".table-meta");
  if (meta) meta.textContent = `${rows.length} of ${listings.length} unit${listings.length === 1 ? "" : "s"}`;
  item.querySelectorAll("[data-sort-key]").forEach((header) => {
    const active = header.dataset.sortKey === state.sortKey;
    header.setAttribute("aria-sort", active ? (state.sortDir === "desc" ? "descending" : "ascending") : "none");
    const button = header.querySelector("button");
    if (!button) return;
    const label = button.dataset.label || button.textContent.replace(/ [↑↓]$/, "");
    button.textContent = active ? `${label} ${state.sortDir === "desc" ? "↓" : "↑"}` : label;
  });
}

function renderListingsTable(id, listings) {
  const state = getTableState(id);
  const rows = visibleListings(id, listings);
  const wrap = document.createElement("div");
  wrap.className = "listings-panel";

  const tools = document.createElement("div");
  tools.className = "table-tools";
  tools.innerHTML = `
    <input data-filter="query" class="grow" type="search" placeholder="Filter units" value="${escapeAttr(state.query)}" />
    <input data-filter="maxRent" class="narrow" type="number" min="0" placeholder="Max $" value="${escapeAttr(state.maxRent)}" />
    <select data-filter="bedrooms" class="narrow">
      <option value="">Beds</option>
      <option value="0">Studio</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3+</option>
    </select>
  `;
  tools.querySelector('[data-filter="bedrooms"]').value = state.bedrooms;

  const meta = document.createElement("div");
  meta.className = "table-meta";
  meta.textContent = `${rows.length} of ${listings.length} unit${listings.length === 1 ? "" : "s"}`;

  const tableWrap = document.createElement("div");
  tableWrap.className = "listings-wrap";
  const table = document.createElement("table");
  table.className = "listings";
  table.innerHTML = `
    <thead>
      <tr>
        ${sortHeader("unit", "Unit", state, false)}
        ${sortHeader("price", "Price", state, true)}
        ${sortHeader("beds", "Bed / Bath", state, true)}
        ${sortHeader("sqft", "Sqft", state, true)}
        ${sortHeader("available", "Available", state, false)}
      </tr>
    </thead>
  `;
  const body = document.createElement("tbody");
  fillListingRows(body, rows);
  table.append(body);
  tableWrap.append(table);
  wrap.append(tools, meta, tableWrap);
  return wrap;
}

function renderDiagnosticReport(report, { showCopy = false, showEvidence = false } = {}) {
  const root = document.createElement("div");
  root.className = "report";
  if (!report) return root;

  if (report.outcome === "ANALYZING") {
    const line = document.createElement("div");
    line.className = "analysis-headline";
    line.textContent = report.headline || "Testing extraction…";
    root.append(line);
    return root;
  }

  const counts = document.createElement("div");
  counts.className = "report-counts";
  counts.append(
    kv("Candidates", report.listingsFound ?? 0),
    kv("Valid", report.validListings ?? 0),
    kv("Duplicates removed", report.duplicatesRemoved ?? 0),
    kv("Rejected", report.rejected ?? 0),
  );
  root.append(counts);

  const method = document.createElement("div");
  method.className = "report-row";
  method.append(kv("Extraction method", report.extractionMethod || "none"));
  method.append(kv("Confidence", report.confidence || "none"));
  root.append(method);

  if (report.strategies?.length) {
    const list = document.createElement("ul");
    list.className = "strategies";
    for (const strategy of report.strategies) {
      const item = document.createElement("li");
      item.className = strategy.worked ? "ok" : "miss";
      const produced = strategy.produced ? ` · ${strategy.produced} listing${strategy.produced === 1 ? "" : "s"}` : "";
      item.textContent = `${strategy.worked ? "✓" : "✗"} ${strategy.label}${produced}`;
      list.append(item);
    }
    root.append(list);
  }

  if (report.problems?.length) {
    const problems = document.createElement("ul");
    problems.className = "problems";
    for (const problem of report.problems) {
      const item = document.createElement("li");
      item.textContent = problem;
      problems.append(item);
    }
    root.append(problems);
  }

  if (report.recommendedNextStep) {
    const next = document.createElement("div");
    next.className = "report-kv";
    next.innerHTML = "";
    next.append(kv("Recommended next step", report.recommendedNextStep));
    root.append(next);
  }

  for (const listing of report.listings || []) {
    root.append(renderListingDiagnostics(listing, showEvidence));
  }

  if (report.summaryText) {
    const pre = document.createElement("pre");
    pre.className = "report-pre";
    pre.textContent = report.summaryText;
    root.append(pre);
  }

  if (showCopy && report.summaryText) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-report";
    copy.dataset.copyReport = "true";
    copy.textContent = "Copy report";
    root.append(copy);
  }

  return root;
}

function renderListingDiagnostics(listing, showEvidence) {
  const block = document.createElement("div");
  block.className = "diag-listing";

  const head = document.createElement("div");
  head.className = "diag-listing-head";
  const label = listing.unit || listing.floorPlan || "Listing";
  const sources = (listing.sources || [listing.source]).filter(Boolean).join(", ");
  head.textContent = `${label} · ${sources || "unknown"} · ${listing.confidence || "LOW"}`;
  block.append(head);

  const fields = document.createElement("ul");
  fields.className = "field-list";
  for (const field of Object.values(listing.fields || {})) {
    const item = document.createElement("li");
    const found = field.status !== "missing";
    item.className = field.status === "ok" ? "field-ok" : "field-warn";
    if (found && field.status === "ok") {
      item.textContent = `${field.label}: ${field.display} ✓`;
    } else if (found) {
      item.textContent = `${field.label}: ${field.display || "—"} ⚠ ambiguous`;
    } else {
      item.textContent = `${field.label}: ⚠ not found`;
    }

    if (showEvidence && (field.snippet || field.selector || field.origin)) {
      const evidence = document.createElement("div");
      evidence.className = "evidence";
      const bits = [
        field.source ? `source=${field.source}` : null,
        field.origin ? `origin=${field.origin}` : null,
        field.selector ? `selector=${field.selector}` : null,
        field.method ? `method=${field.method}` : null,
        field.snippet ? `evidence="${field.snippet}"` : null,
      ].filter(Boolean);
      evidence.textContent = bits.join(" · ");
      item.append(evidence);
    }
    fields.append(item);
  }
  block.append(fields);
  return block;
}

function kv(label, value) {
  const wrap = document.createElement("span");
  wrap.className = "report-kv";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  wrap.append(strong, document.createTextNode(String(value)));
  return wrap;
}

function renderAnalysis(apartment) {
  const analysis = apartment.analysis;
  const listings = apartment.listings || [];
  listingsByApartment.set(apartment.id, listings);
  const block = document.createElement("div");
  const outcome = analysis?.outcome || "NONE";
  block.className = `analysis analysis-${outcome.toLowerCase()}`;

  if (!analysis || outcome === "NONE") {
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = apartment.status;
    block.append(status);
    return block;
  }

  const headline = document.createElement("div");
  headline.className = "analysis-headline";
  headline.textContent = analysis.headline || apartment.status;
  block.append(headline);

  for (const line of analysis.details || []) {
    const detail = document.createElement("div");
    detail.className = "analysis-detail";
    detail.textContent = line;
    block.append(detail);
  }

  if (listings.length) {
    block.append(renderListingsTable(apartment.id, listings));
    const confidence = document.createElement("div");
    confidence.className = "analysis-detail";
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const listing of listings) counts[listing.confidence] = (counts[listing.confidence] || 0) + 1;
    confidence.textContent = `Confidence: ${["HIGH", "MEDIUM", "LOW"]
      .filter((level) => counts[level])
      .map((level) => `${counts[level]} ${level}`)
      .join(", ")}`;
    block.append(confidence);
  }

  if (diagnosticsMode && analysis.diagnostics) {
    block.append(renderDiagnosticReport(analysis.diagnostics, { showEvidence: true }));
  }

  return block;
}

function renderApartment(apartment) {
  const item = document.createElement("li");
  item.className = "apartment";
  item.dataset.apartmentId = apartment.id;

  const link = document.createElement("a");
  link.className = "apartment-name";
  link.href = apartment.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = apartment.url;
  link.textContent = displayName(apartment);

  const analysis = renderAnalysis(apartment);

  const meta = document.createElement("div");
  meta.className = "apartment-meta";

  const added = document.createElement("div");
  added.className = "apartment-details";
  added.textContent = `Added ${formatAddedDate(apartment.dateAdded)}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  const analyze = document.createElement("button");
  analyze.type = "button";
  analyze.className = "analyze";
  analyze.dataset.analyzeId = apartment.id;
  analyze.dataset.analyzeUrl = apartment.url;
  analyze.textContent = apartment.status === "Analyzing…" ? "Analyzing…" : "Analyze";
  analyze.disabled = apartment.status === "Analyzing…";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.dataset.removeId = apartment.id;
  remove.textContent = "Delete";

  actions.append(analyze, remove);
  meta.append(added, actions);
  item.append(link, analysis, meta);
  return item;
}

async function renderApartments() {
  const apartments = await getApartments();
  apartmentList.replaceChildren();

  if (apartments.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  apartments
    .slice()
    .reverse()
    .forEach((apartment) => {
      apartmentList.append(renderApartment(apartment));
    });
}

function setTestPanelOpen(open) {
  testPanel.hidden = !open;
  testToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

async function renderTestReport({ reveal = false } = {}) {
  const report = await getLastTestExtraction();
  testReport.replaceChildren();
  clearTestButton.hidden = !report;
  if (!report) return;
  if (report.url && !testUrlInput.value) testUrlInput.value = report.url;
  if (reveal || report.outcome === "ANALYZING") setTestPanelOpen(true);
  testReport.append(renderDiagnosticReport(report, { showCopy: true, showEvidence: true }));
}

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
    return;
  }
  if (result === "timeout") {
    setBackendStatus("error", "Backend is still starting — give it a moment, then reopen the popup.");
    return;
  }
  setBackendStatus(
    "error",
    "Run npm run launcher:install once (or npm run launcher in a terminal) so AptWatch can start the backend.",
  );
}

async function init() {
  tablePrefs = await getUiPrefs();
  diagnosticsMode = await getDiagnosticsMode();
  diagnosticsToggle.checked = diagnosticsMode;
  document.body.classList.toggle("diagnostics-on", diagnosticsMode);
  await connectBackend();
  await syncFromBackend();
  await renderApartments();
  await renderTestReport();
}

init();
