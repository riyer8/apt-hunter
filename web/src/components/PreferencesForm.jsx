import { FEATURES, defaultUserPrefs } from "@shared/match.js";

const BED_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3+" },
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
        <label className="field">
          <span>Search name</span>
          <input value={prefs.name} onChange={(event) => set("name", event.target.value)} placeholder="Studio, 2 bed 2 bath…" />
        </label>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Budget</h2>
          <label className="toggle">
            <input type="checkbox" checked={prefs.hard.maxRent} onChange={(event) => setHard("maxRent", event.target.checked)} />
            Must stay under max rent
          </label>
        </div>
        <label className="field">
          <span>Max rent</span>
          <input type="number" min="0" placeholder="Any" value={prefs.maxRent} onChange={(event) => set("maxRent", event.target.value)} />
        </label>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Bedrooms</h2>
          <label className="toggle">
            <input type="checkbox" checked={prefs.hard.bedrooms} onChange={(event) => setHard("bedrooms", event.target.checked)} />
            Must match
          </label>
        </div>
        <div className="toggles">
          {BED_OPTIONS.map((option) => (
            <label className="toggle" key={option.value}>
              <input type="checkbox" checked={prefs.bedrooms.includes(option.value)} onChange={() => toggleBed(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Bathrooms</h2>
          <label className="toggle">
            <input type="checkbox" checked={prefs.hard.bathrooms} onChange={(event) => setHard("bathrooms", event.target.checked)} />
            Must match
          </label>
        </div>
        <label className="field">
          <span>Minimum bathrooms</span>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Any"
            value={prefs.minBathrooms}
            onChange={(event) => set("minBathrooms", event.target.value)}
          />
        </label>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Size</h2>
          <label className="toggle">
            <input type="checkbox" checked={prefs.hard.minSqft} onChange={(event) => setHard("minSqft", event.target.checked)} />
            Min sqft is required
          </label>
        </div>
        <div className="filters" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field">
            <span>Minimum sqft</span>
            <input type="number" min="0" placeholder="Any" value={prefs.minSqft} onChange={(event) => set("minSqft", event.target.value)} />
          </label>
          <label className="field">
            <span>Maximum sqft</span>
            <input type="number" min="0" placeholder="Any" value={prefs.maxSqft} onChange={(event) => set("maxSqft", event.target.value)} />
          </label>
        </div>
        <label className="toggle" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={prefs.hard.maxSqft} onChange={(event) => setHard("maxSqft", event.target.checked)} />
          Max sqft is required
        </label>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Move-in date</h2>
          <label className="toggle">
            <input type="checkbox" checked={prefs.hard.moveIn} onChange={(event) => setHard("moveIn", event.target.checked)} />
            Must fall in this window
          </label>
        </div>
        <div className="filters" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field">
            <span>Earliest</span>
            <input type="date" value={prefs.moveInEarliest} onChange={(event) => set("moveInEarliest", event.target.value)} />
          </label>
          <label className="field">
            <span>Latest</span>
            <input type="date" value={prefs.moveInLatest} onChange={(event) => set("moveInLatest", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Location</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={prefs.hard.neighborhoods}
              onChange={(event) => setHard("neighborhoods", event.target.checked)}
            />
            Must be in these areas
          </label>
        </div>
        <label className="field">
          <span>Preferred neighborhoods/areas</span>
          <input
            placeholder="SoMa, Dogpatch, Mission"
            value={prefs.neighborhoodsText}
            onChange={(event) => set("neighborhoodsText", event.target.value)}
          />
        </label>
      </section>

      <section className="prefs-section">
        <div className="section-head">
          <h2>Amenities</h2>
          <p>Required features fail a listing if they are known NO. UNKNOWN is never treated as no.</p>
        </div>
        <div className="amenity-grid">
          <div>
            <h3>Required</h3>
            {FEATURES.map((feature) => (
              <label className="toggle" key={`req-${feature.id}`}>
                <input
                  type="checkbox"
                  checked={prefs.requiredFeatures.includes(feature.id)}
                  onChange={() => toggleFeature("requiredFeatures", feature.id)}
                />
                {feature.label}
              </label>
            ))}
          </div>
          <div>
            <h3>Preferred</h3>
            {FEATURES.map((feature) => (
              <label className="toggle" key={`pref-${feature.id}`}>
                <input
                  type="checkbox"
                  checked={prefs.preferredFeatures.includes(feature.id)}
                  onChange={() => toggleFeature("preferredFeatures", feature.id)}
                />
                {feature.label}
              </label>
            ))}
          </div>
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
    name: prefs.name || "Search",
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
