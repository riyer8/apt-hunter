/**
 * Runs in the page MAIN world. Snapshots listing-related JS state
 * into a DOM node that isolated-world extractors can read.
 */
(function snapshotPageState() {
  const GLOBAL_KEYS = [
    "__NEXT_DATA__",
    "__NUXT__",
    "__APOLLO_STATE__",
    "__INITIAL_STATE__",
    "__PRELOADED_STATE__",
    "apartmentData",
    "unitData",
    "floorPlans",
    "availableUnits",
    "propertyData",
    "pageData",
    "appData",
    "rentalData",
    "Fusion",
  ];

  const ARRAY_KEYS =
    /^(units|availableunits|unitlist|apartments|listings|floorplans|availability|vacancies|homes)$/i;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function looksLikeUnit(obj) {
    if (!isPlainObject(obj)) return false;
    const keys = Object.keys(obj).map((key) => key.toLowerCase());
    const has = (parts) => keys.some((key) => parts.some((part) => key.includes(part)));
    const identity = has(["unit", "apt", "floorplan", "floor_plan", "plan"]);
    const facts = has([
      "price",
      "rent",
      "bed",
      "bath",
      "sqft",
      "sq_ft",
      "square",
      "available",
      "vacant",
    ]);
    return identity && facts;
  }

  function collect(value, depth, visited, buckets) {
    if (depth > 8 || value == null) return;
    if (typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length >= 1 && value.length <= 400 && isPlainObject(value[0])) {
        const unitCount = value.filter(looksLikeUnit).length;
        if (unitCount >= 1 && unitCount / Math.min(value.length, 20) >= 0.4) {
          buckets.push(value);
          return;
        }
      }
      const limit = Math.min(value.length, 80);
      for (let i = 0; i < limit; i += 1) collect(value[i], depth + 1, visited, buckets);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (ARRAY_KEYS.test(key) && Array.isArray(child) && child.length) {
        buckets.push(child);
        continue;
      }
      collect(child, depth + 1, visited, buckets);
    }
  }

  function safeJson(value) {
    const seen = new WeakSet();
    try {
      return JSON.stringify(value, (_key, current) => {
        if (typeof current === "object" && current !== null) {
          if (seen.has(current)) return undefined;
          seen.add(current);
        }
        if (typeof current === "function" || typeof current === "undefined") return undefined;
        return current;
      });
    } catch {
      return "[]";
    }
  }

  const buckets = [];
  const visited = new WeakSet();

  for (const key of GLOBAL_KEYS) {
    try {
      if (window[key]) collect(window[key], 0, visited, buckets);
    } catch {
      /* ignore cross-origin / getter errors */
    }
  }

  try {
    for (const key of Object.keys(window)) {
      if (!/unit|apartment|floorplan|listing|availability|rent|propertydata|pagedata|^Fusion$/i.test(key)) {
        continue;
      }
      collect(window[key], 0, visited, buckets);
    }
  } catch {
    /* ignore */
  }

  const unique = [];
  const seenJson = new Set();
  for (const bucket of buckets) {
    const json = safeJson(bucket);
    if (!json || json === "[]" || seenJson.has(json) || json.length > 1_500_000) continue;
    seenJson.add(json);
    unique.push(bucket);
  }

  const existing = document.getElementById("aptwatch-page-state");
  if (existing) existing.remove();

  // Use <template>, not <script>: Trusted Types (e.g. Google) block
  // untrusted strings on script.textContent / script.innerHTML.
  const payload = safeJson(unique).slice(0, 1_500_000);
  const node = document.createElement("template");
  node.id = "aptwatch-page-state";
  node.setAttribute("data-aptwatch", "page-state");
  try {
    node.textContent = payload;
    document.documentElement.appendChild(node);
  } catch {
    /* ignore pages that block even non-script sinks */
  }
})();
