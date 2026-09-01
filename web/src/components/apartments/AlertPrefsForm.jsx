import { useEffect, useState } from "react";
import * as api from "../../api/apartments.js";

export default function AlertPrefsForm({ apartmentId, initial }) {
  const [prefs, setPrefs] = useState(
    initial || {
      newListings: true,
      priceDrops: true,
      priceIncreases: false,
      availabilityChanges: true,
      maxRent: "",
      minSqft: "",
      bedrooms: "",
      bathrooms: "",
      availableBy: "",
    },
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) setPrefs({ ...prefsFromApi(initial) });
  }, [initial]);

  function set(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const next = await api.saveAlertPrefs(apartmentId, {
        ...prefs,
        maxRent: prefs.maxRent === "" ? null : prefs.maxRent,
        minSqft: prefs.minSqft === "" ? null : prefs.minSqft,
        bedrooms: prefs.bedrooms === "" ? null : prefs.bedrooms,
        bathrooms: prefs.bathrooms === "" ? null : prefs.bathrooms,
        availableBy: prefs.availableBy || null,
      });
      setPrefs(prefsFromApi(next));
      setSaved(true);
    } catch (err) {
      setError(err.message || "Save failed.");
    }
  }

  return (
    <details className="metadata-panel alert-prefs-panel">
      <summary className="metadata-panel-summary">
        <span>Alerts</span>
        <span className="metadata-panel-hint">Email when units change</span>
      </summary>
      <div className="metadata-panel-body">
        <form className="alert-prefs" onSubmit={onSubmit}>
          <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={prefs.newListings} onChange={(event) => set("newListings", event.target.checked)} />
          New
        </label>
        <label className="toggle">
          <input type="checkbox" checked={prefs.priceDrops} onChange={(event) => set("priceDrops", event.target.checked)} />
          Drops
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={prefs.priceIncreases}
            onChange={(event) => set("priceIncreases", event.target.checked)}
          />
          Increases
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={prefs.availabilityChanges}
            onChange={(event) => set("availabilityChanges", event.target.checked)}
          />
          Avail.
        </label>
          </div>
          <div className="alert-prefs-filters">
        <label className="filter-group">
          <span className="filter-group-label">Rent ≤</span>
          <input className="filter-input" type="number" min="0" placeholder="Any" value={prefs.maxRent} onChange={(event) => set("maxRent", event.target.value)} />
        </label>
        <label className="filter-group">
          <span className="filter-group-label">Sqft ≥</span>
          <input className="filter-input" type="number" min="0" placeholder="Any" value={prefs.minSqft} onChange={(event) => set("minSqft", event.target.value)} />
        </label>
        <label className="filter-group filter-group-select">
          <span className="filter-group-label">Beds</span>
          <select className="filter-input" value={prefs.bedrooms} onChange={(event) => set("bedrooms", event.target.value)}>
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </label>
        <label className="filter-group">
          <span className="filter-group-label">Baths ≥</span>
          <input className="filter-input" type="number" min="0" step="0.5" placeholder="Any" value={prefs.bathrooms} onChange={(event) => set("bathrooms", event.target.value)} />
        </label>
        <label className="filter-group">
          <span className="filter-group-label">By</span>
          <input className="filter-input" type="date" value={prefs.availableBy || ""} onChange={(event) => set("availableBy", event.target.value)} />
        </label>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="alert-prefs-actions">
            <button type="submit" className="btn btn-primary btn-small">
              Save
            </button>
            {saved ? <span className="saved-hint">Saved</span> : null}
          </div>
        </form>
      </div>
    </details>
  );
}

function prefsFromApi(prefs) {
  return {
    newListings: prefs.newListings !== false,
    priceDrops: prefs.priceDrops !== false,
    priceIncreases: Boolean(prefs.priceIncreases),
    availabilityChanges: prefs.availabilityChanges !== false,
    maxRent: prefs.maxRent ?? "",
    minSqft: prefs.minSqft ?? "",
    bedrooms: prefs.bedrooms ?? "",
    bathrooms: prefs.bathrooms ?? "",
    availableBy: prefs.availableBy || "",
  };
}
