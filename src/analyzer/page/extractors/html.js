AptWatchAnalyzer.register("html", function extractHtml() {
  return [
    ...extractSpacesUnits(),
    ...extractUnitCards(),
    ...extractFromTables(),
    ...extractFromMicrodata(),
    ...extractFromDataAttributes(),
    ...extractHeadingCards(),
  ];
});

function extractSpacesUnits() {
  const records = [];
  const nodes = document.querySelectorAll(
    "article.spaces-unit[data-spaces-unit], [data-spaces-unit][data-spaces-sort-price]",
  );

  for (const node of nodes) {
    const unit = node.getAttribute("data-spaces-unit");
    const priceRaw = node.getAttribute("data-spaces-sort-price");
    const plan = node.getAttribute("data-spaces-sort-plan-name");
    const beds = node.getAttribute("data-spaces-sort-bed");
    const baths = node.getAttribute("data-spaces-sort-bath");
    const sqft = node.getAttribute("data-spaces-sort-area");
    const available = node.getAttribute("data-spaces-soonest");
    const href = node.getAttribute("data-spaces-href") || node.getAttribute("data-spaces-inventory-href");

    const record = AptWatchAnalyzer.recordFromVisibleText(node.innerText || node.getAttribute("aria-label") || "");
    if (unit) record.unit = unit;
    if (plan) record.floorPlan = plan;
    if (priceRaw) record.price = priceRaw;
    if (beds != null && beds !== "") record.bedrooms = beds;
    if (baths != null && baths !== "") record.bathrooms = baths;
    if (sqft) record.sqft = sqft;
    if (available) record.availableDate = available;
    if (href) record.url = href;

    if (hasListingShape(record)) {
      records.push(AptWatchAnalyzer.stampRecord(record, node, "spaces-unit"));
    }
  }

  return records;
}

function extractUnitCards() {
  const records = [];
  const nodes = document.querySelectorAll(
    ".unit-item, [class*='unit-item'], [class*='unit-card'], [class*='unitCard'], article",
  );

  for (const node of nodes) {
    const text = (node.innerText || "").replace(/\s+/g, " ").trim();
    if (text.length < 20 || text.length > 2000) continue;
    if (!hasPriceSignal(text)) continue;
    if (!/(bed|bath|studio|sq\.?\s*ft|sqft)/i.test(text)) continue;

    const record = AptWatchAnalyzer.recordFromVisibleText(text);
    const heading = node.querySelector("h2, h3, h4");
    if (heading) {
      const headingRecord = AptWatchAnalyzer.recordFromVisibleText(heading.innerText.trim());
      record.unit = headingRecord.unit || record.unit;
      record.floorPlan = record.floorPlan || headingRecord.floorPlan;
    }
    const link = node.querySelector("a[href*='apartment'], a[href*='unit'], a[href]:not([href^='#'])");
    if (link?.href && !/#/.test(link.getAttribute("href") || "")) record.url = link.href;
    else     if (link?.href && /\/apartment\//.test(link.href)) record.url = link.href;
    if (hasListingShape(record)) records.push(AptWatchAnalyzer.stampRecord(record, node, "unit-card"));
  }

  return records;
}

function hasPriceSignal(text) {
  return (
    /\$\s*[\d,]{3,}/.test(text) ||
    /price\s*:?\s*\$?[\d,]{3,}/i.test(text) ||
    /starting at\s*\$?[\d,]/i.test(text)
  );
}

function extractFromTables() {
  const records = [];

  for (const table of document.querySelectorAll("table")) {
    const headerCells = [...table.querySelectorAll("thead th, tr:first-child th, tr:first-child td")];
    if (!headerCells.length) continue;

    const mapping = headerCells.map((cell) => fieldFromHeader(cell.textContent));
    const useful = mapping.filter(Boolean);
    if (useful.length < 2) continue;
    if (!useful.some((field) => field === "unit" || field === "floorPlan" || field === "price")) {
      continue;
    }

    const context = nearbyContext(table);
    const rows = [...table.querySelectorAll("tbody tr, tr")].filter((row) => {
      return row.querySelectorAll("td").length >= 2 && !row.querySelector("th");
    });

    for (const row of rows) {
      const cells = [...row.querySelectorAll("td")];
      const firstCell = (cells[0]?.innerText || "").trim();
      if (/^(unit|apt|apartment|floor plan)$/i.test(firstCell)) continue;

      const record = { ...context, text: `${context.text || ""} ${row.innerText || ""}`.trim() };
      mapping.forEach((field, index) => {
        if (!field || !cells[index]) return;
        record[field] = cells[index].innerText.trim();
      });
      const link = row.querySelector("a[href]");
      if (link?.href) record.url = link.href;
      if (Object.keys(record).filter((key) => key !== "text").length >= 2) {
        records.push(AptWatchAnalyzer.stampRecord(record, row, "table"));
      }
    }
  }

  return records;
}

function fieldFromHeader(text) {
  const value = AptWatchAnalyzer.normKey(text || "");
  if (!value) return null;
  if (/^(unitorapt|aptno|apt|unitno|unit|apartment)$/.test(value)) return "unit";
  if (/floorplan|planname|layout|model/.test(value) && !/floor$/.test(value)) return "floorPlan";
  if (/price|rent|monthly/.test(value)) return "price";
  if (/^(bed|beds|bedrooms|br|bd)$/.test(value)) return "bedrooms";
  if (/^(bath|baths|bathrooms|ba)$/.test(value)) return "bathrooms";
  if (/sqft|squarefeet|sqfeet|size|sf/.test(value)) return "sqft";
  if (/available|availability|movein/.test(value)) return "availableDate";
  return AptWatchAnalyzer.fieldForKey(value);
}

function nearbyContext(node) {
  const record = AptWatchAnalyzer.recordFromVisibleText(headingText(node));
  delete record.unit;
  delete record.price;
  return record;
}

function headingText(node) {
  const parts = [];
  let current = node;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const heading = current.querySelector?.("h1, h2, h3, h4, h5");
    if (heading) parts.push(heading.innerText);
    const previous = current.previousElementSibling;
    if (previous && /H[1-5]/.test(previous.tagName)) parts.push(previous.innerText);
    current = current.parentElement;
  }
  return parts.join(" ");
}

function extractFromMicrodata() {
  const records = [];
  const nodes = document.querySelectorAll(
    '[itemtype*="Apartment"], [itemtype*="Residence"], [itemtype*="Offer"], [itemtype*="FloorPlan"]',
  );

  for (const node of nodes) {
    const get = (prop) =>
      node.querySelector(`[itemprop="${prop}"]`)?.getAttribute("content") ||
      node.querySelector(`[itemprop="${prop}"]`)?.innerText?.trim();

    const record = {
      unit: get("unitNumber") || get("identifier"),
      floorPlan: get("name"),
      price: get("price"),
      bedrooms: get("numberOfBedrooms") || get("numberOfRooms"),
      bathrooms: get("numberOfBathroomsTotal"),
      sqft: get("floorSize") || get("value"),
      availableDate: get("availabilityStarts"),
      url: node.querySelector('[itemprop="url"]')?.getAttribute("href") || node.getAttribute("itemid"),
      text: (node.innerText || "").replace(/\s+/g, " ").trim(),
    };

    if (hasListingShape(record)) records.push(AptWatchAnalyzer.stampRecord(record, node, "microdata"));
  }

  return records;
}

function extractFromDataAttributes() {
  const records = [];
  const nodes = document.querySelectorAll("[data-unit], [data-unit-id], [data-unit-number], [data-floorplan]");

  for (const node of nodes) {
    const record = AptWatchAnalyzer.recordFromVisibleText(node.innerText);
    record.unit =
      node.getAttribute("data-unit") ||
      node.getAttribute("data-unit-id") ||
      node.getAttribute("data-unit-number") ||
      record.unit;
    record.floorPlan = node.getAttribute("data-floorplan") || record.floorPlan;
    record.price = node.getAttribute("data-price") || node.getAttribute("data-rent") || record.price;
    const link = node.querySelector("a[href]") || (node.tagName === "A" ? node : null);
    if (link?.href) record.url = link.href;
    if (hasListingShape(record)) records.push(AptWatchAnalyzer.stampRecord(record, node, "data-attr"));
  }

  return records;
}

function extractHeadingCards() {
  const records = [];

  for (const heading of document.querySelectorAll("h2, h3, h4")) {
    const parent = heading.parentElement;
    if (!parent) continue;
    const text = (parent.innerText || "").replace(/\s+/g, " ").trim();
    if (parent.querySelector("table")) continue;
    if (text.length < 20 || text.length > 1500) continue;
    if (!/(\$\s*[\d,]{3,}|starting at\s*\$?[\d,]|price\s*:?\s*[\d,])/i.test(text)) continue;
    if (!/(bed|bath|studio|sq\.?\s*ft|sqft)/i.test(text)) continue;

    const record = AptWatchAnalyzer.recordFromVisibleText(text);
    const headingRecord = AptWatchAnalyzer.recordFromVisibleText(heading.innerText.trim());
    record.unit = headingRecord.unit || record.unit;
    record.floorPlan = record.floorPlan || headingRecord.floorPlan;
    const link = parent.querySelector("a[href]:not([href^='#'])");
    if (link?.href) record.url = link.href;
    if (hasListingShape(record)) records.push(AptWatchAnalyzer.stampRecord(record, parent, "heading-card"));
  }

  return records;
}

function hasListingShape(record) {
  const identity = Boolean(record.unit || record.floorPlan || record.url);
  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].some((field) => record[field]);
  return identity && facts;
}
