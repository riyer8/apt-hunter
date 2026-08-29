import { FEATURES, defaultUserPrefs } from "@shared/match.js";

const BED_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1 bed" },
  { value: 2, label: "2 bed" },
  { value: 3, label: "3+ bed" },
];

const DEALBREAKERS = [
  { key: "maxRent", label: "Rent" },
  { key: "bedrooms", label: "Beds" },
  { key: "bathrooms", label: "Baths" },
  { key: "minSqft", label: "Min sqft" },
  { key: "maxSqft", label: "Max sqft" },
  { key: "moveIn", label: "Dates" },
  { key: "neighborhoods", label: "Area" },
];

export default function PreferencesForm({ value, onChange }) {
  const prefs = fromApi(value);

  function set(key, next) {
    onChange?.(toApi({ ...prefs, [key]: next }));
  }

  function setHard(key, next) {
    onChange?.(toApi({ ...prefs, hard: { ...prefs.hard, [key]: next } }));
  }

  function toggleBed(bed) {
    const has = prefs.bedrooms.includes(bed);
    const bedrooms = has ? prefs.bedrooms.filter((item) => item !== bed) : [...prefs.bedrooms, bed].sort();
    onChange?.(toApi({ ...prefs, bedrooms }));
  }

  function toggleFeature(listKey, id) {
    const on = prefs[listKey].includes(id);
    const next = {
      ...prefs,
      [listKey]: on ? prefs[listKey].filter((item) => item !== id) : [...prefs[listKey], id],
    };
    if (listKey === "requiredFeatures" && !on) {
      next.preferredFeatures = next.preferredFeatures.filter((item) => item !== id);
    }
    if (listKey === "preferredFeatures" && !on) {
      next.requiredFeatures = next.requiredFeatures.filter((item) => item !== id);
    }
    onChange?.(toApi(next));
  }

  return (
    <div className="prefs-form">
      <section className="prefs-section">
        <div className="section-head">
          <h2>Unit</h2>
        </div>

        <div className="prefs-row prefs-row-4">
          <label className="field">
            <span>Max rent /mo</span>
            <input type="number" min="0" placeholder="Any" value={prefs.maxRent} onChange={(event) => set("maxRent", event.target.value)} />
          </label>
          <label className="field">
            <span>Min baths</span>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Any"
              value={prefs.minBathrooms}
              onChange={(event) => set("minBathrooms", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Min sqft</span>
            <input type="number" min="0" placeholder="Any" value={prefs.minSqft} onChange={(event) => set("minSqft", event.target.value)} />
          </label>
          <label className="field">
            <span>Max sqft</span>
            <input type="number" min="0" placeholder="Any" value={prefs.maxSqft} onChange={(event) => set("maxSqft", event.target.value)} />
          </label>
        </div>

        <div className="prefs-inline">
          <span className="prefs-inline-label">Bedrooms</span>
          <div className="pill-group">
            {BED_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={prefs.bedrooms.includes(option.value) ? "pill active" : "pill"}
                onClick={() => toggleBed(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="prefs-dealbreakers">
          <span className="prefs-inline-label">Dealbreakers</span>
          <div className="pill-group pill-group-compact">
            {DEALBREAKERS.map((item) => (
              <label key={item.key} className={`pill pill-check ${prefs.hard[item.key] ? "active" : ""}`}>
                <input type="checkbox" checked={prefs.hard[item.key]} onChange={(event) => setHard(item.key, event.target.checked)} />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>When &amp; where</h2>
        </div>

        <div className="prefs-row prefs-row-3">
          <label className="field">
            <span>Move in from</span>
            <input type="date" value={prefs.moveInEarliest} onChange={(event) => set("moveInEarliest", event.target.value)} />
          </label>
          <label className="field">
            <span>Move in by</span>
            <input type="date" value={prefs.moveInLatest} onChange={(event) => set("moveInLatest", event.target.value)} />
          </label>
          <label className="field">
            <span>Neighborhoods</span>
            <input
              placeholder="SoMa, Dogpatch, Mission"
              value={prefs.neighborhoodsText}
              onChange={(event) => set("neighborhoodsText", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Amenities</h2>
          <p className="prefs-hint">Check Required or Preferred — or both columns for either.</p>
        </div>
        <div className="amenity-table">
          <div className="amenity-table-head">
            <span>Amenity</span>
            <span>Required</span>
            <span>Preferred</span>
          </div>
          {FEATURES.map((feature) => (
            <div className="amenity-table-row" key={feature.id}>
              <span>{feature.label}</span>
              <label className="amenity-check">
                <input
                  type="checkbox"
                  checked={prefs.requiredFeatures.includes(feature.id)}
                  onChange={() => toggleFeature("requiredFeatures", feature.id)}
                />
              </label>
              <label className="amenity-check">
                <input
                  type="checkbox"
                  checked={prefs.preferredFeatures.includes(feature.id)}
                  onChange={() => toggleFeature("preferredFeatures", feature.id)}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function fromApi(prefs) {
  const merged = defaultUserPrefs(prefs || {});
  return {
    ...merged,
    maxRent: merged.maxRent ?? "",
    minBathrooms: merged.minBathrooms ?? "",
    minSqft: merged.minSqft ?? "",
    maxSqft: merged.maxSqft ?? "",
    moveInEarliest: merged.moveInEarliest || "",
    moveInLatest: merged.moveInLatest || "",
    neighborhoodsText: (merged.preferredNeighborhoods || []).join(", "),
  };
}

function toApi(prefs) {
  return {
    id: prefs.id || null,
    name: prefs.name ?? "",
    maxRent: prefs.maxRent === "" ? null : prefs.maxRent,
    bedrooms: prefs.bedrooms,
    minBathrooms: prefs.minBathrooms === "" ? null : prefs.minBathrooms,
    minSqft: prefs.minSqft === "" ? null : prefs.minSqft,
    maxSqft: prefs.maxSqft === "" ? null : prefs.maxSqft,
    moveInEarliest: prefs.moveInEarliest || null,
    moveInLatest: prefs.moveInLatest || null,
    requiredFeatures: prefs.requiredFeatures,
    preferredFeatures: prefs.preferredFeatures,
    preferredNeighborhoods: String(prefs.neighborhoodsText || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    hard: prefs.hard,
  };
}
