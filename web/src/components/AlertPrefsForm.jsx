import { useEffect, useState } from "react";
import * as api from "../api/apartments.js";

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
      setError(err.message || "Could not save alerts.");
    }
  }

  return (
    <form className="alert-prefs" onSubmit={onSubmit}>
      <div className="section-head">
        <h2>Alerts</h2>
      </div>
      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={prefs.newListings} onChange={(event) => set("newListings", event.target.checked)} />
          New listings
        </label>
        <label className="toggle">
          <input type="checkbox" checked={prefs.priceDrops} onChange={(event) => set("priceDrops", event.target.checked)} />
          Price drops
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={prefs.priceIncreases}
            onChange={(event) => set("priceIncreases", event.target.checked)}
          />
          Price increases
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={prefs.availabilityChanges}
            onChange={(event) => set("availabilityChanges", event.target.checked)}
          />
          Availability changes
        </label>
      </div>
      <div className="filters" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", marginTop: 12 }}>
        <label className="field">
          <span>Max rent</span>
          <input type="number" min="0" placeholder="Any" value={prefs.maxRent} onChange={(event) => set("maxRent", event.target.value)} />
        </label>
        <label className="field">
          <span>Min sqft</span>
          <input type="number" min="0" placeholder="Any" value={prefs.minSqft} onChange={(event) => set("minSqft", event.target.value)} />
        </label>
        <label className="field">
          <span>Bedrooms</span>
          <select value={prefs.bedrooms} onChange={(event) => set("bedrooms", event.target.value)}>
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </label>
        <label className="field">
          <span>Bathrooms</span>
          <input type="number" min="0" step="0.5" placeholder="Any" value={prefs.bathrooms} onChange={(event) => set("bathrooms", event.target.value)} />
        </label>
        <label className="field">
          <span>Available by</span>
          <input type="date" value={prefs.availableBy || ""} onChange={(event) => set("availableBy", event.target.value)} />
        </label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
        <button type="submit" className="btn btn-primary">
          Save alerts
        </button>
        {saved ? <span className="lede" style={{ margin: 0 }}>Saved.</span> : null}
      </div>
    </form>
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
