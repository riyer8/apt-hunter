AptWatchAnalyzer.register("text", function extractDomText() {
  return [...extractRepeatingBlocks(), ...extractLabeledBlocks(), ...extractAvailabilityLinks()];
});

function hasPriceSignal(text) {
  return (
    /\$\s*[\d,]{3,}/.test(text) ||
    /price\s*:?\s*\$?[\d,]{3,}/i.test(text) ||
    /starting at\s*\$?[\d,]/i.test(text)
  );
}

function extractRepeatingBlocks() {
  const groups = new Map();
  const candidates = document.querySelectorAll(
    "li, article, tr, a, [class*='card'], [class*='row'], [class*='unit'], [class*='availab'], [class*='listing'], [class*='floorplan'], [class*='floor-plan']",
  );

  for (const node of candidates) {
    const text = (node.innerText || "").replace(/\s+/g, " ").trim();
    if (text.length < 20 || text.length > 900) continue;
    if (!hasPriceSignal(text)) continue;
    if (!/(bed|bd|br|bath|ba|sq\.?\s*ft|sqft|unit|apt|studio|available)/i.test(text)) continue;

    const parent = node.parentElement;
    if (!parent) continue;
    const key = `${parent.tagName}:${parent.className || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }

  let best = [];
  for (const nodes of groups.values()) {
    if (nodes.length >= 2 && nodes.length > best.length) best = nodes;
  }

  return best.map((node) => recordFromNode(node, "repeating-block")).filter(hasListingShape);
}

function extractLabeledBlocks() {
  const matches = [...document.querySelectorAll("div, li, article, section, a, tr")].filter((node) => {
    const text = (node.innerText || "").replace(/\s+/g, " ").trim();
    if (text.length < 24 || text.length > 500) return false;
    return hasPriceSignal(text) && /(available|bed|bath|studio|sq\.?\s*ft)/i.test(text);
  });

  return matches
    .filter((node) => !matches.some((other) => other !== node && node.contains(other)))
    .map((node) => recordFromNode(node, "labeled-block"))
    .filter(hasListingShape);
}

function extractAvailabilityLinks() {
  const records = [];
  const nodes = document.querySelectorAll("a, button, [role='button']");

  for (const node of nodes) {
    const text = `${node.innerText || ""} ${node.getAttribute("aria-label") || ""}`.replace(/\s+/g, " ");
    const href = node.href || node.getAttribute("href") || "";
    if (!href || href.startsWith("#") || /#community|#listings|#availability/i.test(href)) continue;
    const combined = `${text} ${href}`;
    if (!/availability|available|floor[\s-]?plan|apply now|view unit|unit\s*#?\s*[A-Z0-9]/i.test(combined)) {
      continue;
    }

    const record = AptWatchAnalyzer.recordFromVisibleText(`${node.innerText || ""} ${node.getAttribute("aria-label") || ""}`);
    record.url = href;
    if ((record.unit || record.floorPlan) && record.price) {
      records.push(AptWatchAnalyzer.stampRecord(record, node, "availability-link"));
    }
  }

  return records;
}

function recordFromNode(node, method) {
  const record = AptWatchAnalyzer.recordFromVisibleText(node.innerText);
  const link = node.querySelector("a[href]:not([href^='#'])") || (node.tagName === "A" && !String(node.getAttribute("href") || "").startsWith("#") ? node : null);
  if (link?.href && !/#community|#listings/.test(link.href)) record.url = link.href;
  return AptWatchAnalyzer.stampRecord(record, node, method || "dom");
}

function hasListingShape(record) {
  const identity = Boolean(record.unit || record.floorPlan || record.url);
  const facts = ["price", "bedrooms", "bathrooms", "sqft", "availableDate"].some((field) => record[field]);
  return identity && facts;
}
