import { useEffect, useRef, useState } from "react";
import { defaultUserPrefs, cleanSearchName, displaySearchLabel, hasCustomSearchName, normalizePreferenceBundle } from "@shared/match.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import * as api from "../api/apartments.js";
import Shell from "../components/layout/Shell.jsx";
import PreferencesForm from "../components/common/PreferencesForm.jsx";

export default function Preferences() {
  const { source, preferences, savePreferences } = useApartments();
  const [bundle, setBundle] = useState(() => normalizePreferenceBundle(preferences));
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [nameEditing, setNameEditing] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    setBundle(normalizePreferenceBundle(preferences));
  }, [preferences]);

  useEffect(() => {
    setNameEditing(false);
  }, [selected]);

  useEffect(() => {
    if (!focusName || !nameRef.current) return;
    nameRef.current.focus();
    setFocusName(false);
    setNameEditing(true);
  }, [focusName, selected]);

  const profile = bundle.profiles[selected] || bundle.profiles[0];
  const defaultName = profile ? displaySearchLabel(profile, selected).text : "";
  const showDefaultName = profile && !nameEditing && !hasCustomSearchName(profile);

  function updateProfile(next) {
    setSaved(false);
    setBundle((current) => ({
      ...current,
      profiles: current.profiles.map((item, index) => (index === selected ? { ...item, ...next } : item)),
    }));
  }

  function addSearch() {
    setSaved(false);
    const nextIndex = bundle.profiles.length;
    setSelected(nextIndex);
    setBundle((current) => ({
      ...current,
      profiles: [...current.profiles, defaultUserPrefs({ name: "" })],
    }));
    setFocusName(true);
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
      <h1 className="page-title">Preferences</h1>
      <p className="lede">Set what you want in a search — used for match scores on the dashboard.</p>

      <form onSubmit={onSave}>
        <div className="profile-tabs">
          {bundle.profiles.map((item, index) => {
            const label = displaySearchLabel(item, index);
            return (
              <button
                key={item.id || `new-${index}`}
                type="button"
                className={index === selected ? "profile-tab active" : "profile-tab"}
                onClick={() => setSelected(index)}
              >
                <span className={label.isPlaceholder ? "profile-tab-placeholder" : undefined}>{label.text}</span>
              </button>
            );
          })}
          <button type="button" className="profile-tab profile-tab-add" onClick={addSearch}>
            + Add search
          </button>
        </div>

        {profile ? (
          <section className="prefs-section prefs-name-block">
            <label className="field prefs-name-field">
              <span>Name this search</span>
              <div className="prefs-name-wrap">
                <input
                  ref={nameRef}
                  className="prefs-name-input"
                  type="text"
                  value={cleanSearchName(profile.name)}
                  onChange={(event) => updateProfile({ name: event.target.value })}
                  onFocus={() => setNameEditing(true)}
                  onBlur={() => setNameEditing(false)}
                  placeholder=""
                  autoComplete="off"
                  spellCheck={false}
                />
                {showDefaultName ? (
                  <span className="prefs-name-default" aria-hidden="true">
                    {defaultName}
                  </span>
                ) : null}
              </div>
            </label>
          </section>
        ) : null}

        {profile ? <PreferencesForm value={profile} onChange={updateProfile} /> : null}

        <section className="prefs-section">
          <div className="section-head">
            <h2>Notifications</h2>
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
            Match % on new-listing notifications
          </label>
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
          {saved ? <span className="lede" style={{ margin: 0 }}>Saved</span> : null}
        </div>
      </form>
    </Shell>
  );
}
