const EMPHASIS_TERMS = [
  "maintenance",
  "noise",
  "staff",
  "pests",
  "value",
  "management",
  "security",
  "concierge",
  "responsive",
  "walkability",
  "amenities",
  "gym",
  "pool",
  "parking",
  "elevator",
  "laundry",
  "leasing",
  "renovation",
  "reviews",
  "residents",
  "complaints",
  "safety",
  "location",
  "transit",
  "rooftop",
  "mold",
  "fees",
  "move-in",
  "move-out",
  "package room",
  "air conditioning",
];

const EMPHASIS_RE = new RegExp(`\\b(${EMPHASIS_TERMS.join("|")})\\b`, "gi");

export function splitIntoBullets(text) {
  if (!text?.trim()) return [];

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.map((line) => line.replace(/^[-•*]\s*/, ""));
  }

  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function renderBuildingText(text) {
  if (!text) return [];

  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  const nodes = [];

  parts.forEach((part, index) => {
    if (!part) return;

    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push({ type: "strong", key: `md-${index}`, text: part.slice(2, -2) });
      return;
    }

    let lastIndex = 0;
    EMPHASIS_RE.lastIndex = 0;
    let match = EMPHASIS_RE.exec(part);

    while (match) {
      if (match.index > lastIndex) {
        nodes.push({ type: "text", key: `t-${index}-${lastIndex}`, text: part.slice(lastIndex, match.index) });
      }
      nodes.push({ type: "strong", key: `k-${index}-${match.index}`, text: match[0] });
      lastIndex = EMPHASIS_RE.lastIndex;
      match = EMPHASIS_RE.exec(part);
    }

    if (lastIndex < part.length) {
      nodes.push({ type: "text", key: `t-${index}-end`, text: part.slice(lastIndex) });
    }
  });

  return nodes;
}
