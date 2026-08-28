import { useEffect, useState } from "react";
import { defaultUserPrefs, normalizePreferenceBundle } from "@shared/match.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import * as api from "../api/apartments.js";
import Shell from "../components/Shell.jsx";
import PreferencesForm from "../components/PreferencesForm.jsx";

export default function Preferences() {
  const { source, preferences, savePreferences } = useApartments();
  const [bundle, setBundle] = useState(() => normalizePreferenceBundle(preferences));
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setBundle(normalizePreferenceBundle(preferences));
  }, [preferences]);

  const profile = bundle.profiles[selected] || bundle.profiles[0];

  function updateProfile(next) {
    setSaved(false);
    setBundle((current) => ({
      ...current,
      profiles: current.profiles.map((item, index) => (index === selected ? { ...item, ...next } : item)),
    }));
  }

  function addSearch() {
    setSaved(false);
    setSelected(bundle.profiles.length);
    setBundle((current) => ({
      ...current,
      profiles: [...current.profiles, defaultUserPrefs({ name: `Search ${current.profiles.length + 1}` })],
    }));
  }

  function removeSearch() {
    if (bundle.profiles.length <= 1) return;
    setSaved(false);
    const nextIndex = Math.max(0, selected - 1);
    setBundle((current) => ({
      ...current,
      profiles: current.profiles.filter((_, index) => index !== selected),
    }));
    setSelected(nextIndex);
  }

  async function onSave(event) {
    event.preventDefault();
    setError("");
    try {
      const next = await api.saveUserPreferences(bundle);
      const normalized = normalizePreferenceBundle(next);
      setBundle(normalized);
      savePreferences(normalized);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save preferences.");
    }
  }

  return (
    <Shell source={source}>
      <h1 className="page-title">Apartment Preferences</h1>
      <p className="lede">
        Add a separate search for each kind of place you want — a studio hunt and a 2-bed 2-bath hunt can have different
        budgets, sizes, and amenities. A listing qualifies if it fits <em>any</em> search. The badge uses the best fit.
      </p>

      <form onSubmit={onSave}>
        <div className="profile-tabs">
          {bundle.profiles.map((item, index) => (
            <button
              key={item.id || `new-${index}`}
              type="button"
              className={index === selected ? "profile-tab active" : "profile-tab"}
              onClick={() => setSelected(index)}
            >
              {item.name || `Search ${index + 1}`}
            </button>
          ))}
          <button type="button" className="profile-tab profile-tab-add" onClick={addSearch}>
            + Add search
          </button>
        </div>

        {profile ? <PreferencesForm value={profile} onChange={updateProfile} /> : null}

        <section className="prefs-section">
          <div className="section-head">
            <h2>Other preferences</h2>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={bundle.matchAlerts}
              onChange={(event) => {
                setSaved(false);
                setBundle((current) => ({ ...current, matchAlerts: event.target.checked }));
              }}
            />
            Show match % on new-listing Chrome notifications
          </label>
          <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
            Applies to every search. Off by default.
          </p>
        </section>

        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            Save all searches
          </button>
          {bundle.profiles.length > 1 ? (
            <button type="button" className="btn btn-ghost" onClick={removeSearch}>
              Delete this search
            </button>
          ) : null}
          {saved ? <span className="lede" style={{ margin: 0 }}>Saved. Scores update immediately.</span> : null}
        </div>
      </form>
    </Shell>
  );
}
