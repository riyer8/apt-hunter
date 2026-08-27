AptWatchAnalyzer.register("html", function extractHtml() {
  return [
    ...extractFromTables(),
    ...extractFromMicrodata(),
    ...extractFromDataAttributes(),
    ...extractHeadingCards(),
  ];
});

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
      if (Object.keys(record).filter((key) => key !== "text").length >= 2) records.push(record);
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

    if (hasListingShape(record)) records.push(record);
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
    if (hasListingShape(record)) records.push(record);
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
    if (!/(\$\s*[\d,]{3,}|starting at\s*\$?[\d,]|price\s*:?\s*[\d,])/i.test(text)) continue;
    if (!/(bed|bath|studio|sq\.?\s*ft|sqft)/i.test(text)) continue;

    const record = AptWatchAnalyzer.recordFromVisibleText(text);
    record.floorPlan = record.floorPlan || heading.innerText.trim();
    const link = parent.querySelector("a[href]");
    if (link?.href) record.url = link.href;
    if (hasListingShape(record)) records.push(record);
  }

  return records;
}

function hasListingShape(record) {
  const identity = Boolean(record.unit || record.floorPlan || record.url);
  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].some((field) => record[field]);
  return identity && facts;
}
