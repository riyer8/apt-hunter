import {
  addApartment,
  displayName,
  getApartments,
  isDuplicateUrl,
  isValidHttpUrl,
  removeApartment,
} from "../lib/storage.js";

const form = document.getElementById("add-form");
const nameInput = document.getElementById("name-input");
const urlInput = document.getElementById("url-input");
const formError = document.getElementById("form-error");
const emptyState = document.getElementById("empty-state");
const apartmentList = document.getElementById("apartment-list");

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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.apartments) {
    renderApartments();
  }
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

function formatBeds(value) {
  if (value == null) return "—";
  if (value === 0) return "Studio";
  return String(value);
}

function formatAvailable(value) {
  if (value == null) return "—";
  if (value === "now") return "Now";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderListingsTable(listings) {
  const wrap = document.createElement("div");
  wrap.className = "listings-wrap";

  const table = document.createElement("table");
  table.className = "listings";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Unit</th>
        <th class="num">Price</th>
        <th class="num">Beds</th>
        <th class="num">Sqft</th>
        <th>Available</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
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
    beds.textContent = formatBeds(listing.bedrooms);

    const sqft = document.createElement("td");
    sqft.className = "num";
    sqft.textContent = listing.sqft == null ? "—" : String(listing.sqft);

    const available = document.createElement("td");
    available.textContent = formatAvailable(listing.availableDate);

    row.append(unitCell, price, beds, sqft, available);
    body.append(row);
  }

  table.append(body);
  wrap.append(table);
  return wrap;
}

function renderAnalysis(apartment) {
  const analysis = apartment.analysis;
  const listings = [...(apartment.listings || [])].sort((left, right) => {
    const leftLabel = String(left.unit || left.floorPlan || "");
    const rightLabel = String(right.unit || right.floorPlan || "");
    return leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: "base" });
  });
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
    block.append(renderListingsTable(listings));
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

  return block;
}

function renderApartment(apartment) {
  const item = document.createElement("li");
  item.className = "apartment";

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

renderApartments();
