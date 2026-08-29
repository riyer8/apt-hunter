import { useState } from "react";
import { isValidHttpUrl } from "../../lib/format.js";

export default function EditApartmentModal({ apartment, onClose, onSave }) {
  const [name, setName] = useState(apartment.name || "");
  const [url, setUrl] = useState(apartment.url || "");
  const [location, setLocation] = useState(apartment.location || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const urlChanged = url.trim() !== (apartment.url || "").trim();
  const nameChanged = name.trim() !== (apartment.name || "").trim();
  const locationChanged = location.trim() !== (apartment.location || "").trim();
  const hasChanges = urlChanged || nameChanged || locationChanged;

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a building name.");
      return;
    }
    if (!isValidHttpUrl(url.trim())) {
      setError("Enter a valid http:// or https:// availability URL.");
      return;
    }
    if (!hasChanges) {
      onClose();
      return;
    }

    setBusy(true);
    setError("");
    try {
      const patch = {};
      if (nameChanged) patch.name = name.trim();
      if (urlChanged) patch.url = url.trim();
      if (locationChanged) patch.location = location.trim();
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save changes.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-title">Edit building</h2>
        <form className="modal-form" onSubmit={submit}>
          <label htmlFor="edit-apt-name">Building name</label>
          <input
            id="edit-apt-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Building name"
            required
          />
          <label htmlFor="edit-apt-url">Availability URL</label>
          <input
            id="edit-apt-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            required
          />
          <label htmlFor="edit-apt-location">Location</label>
          <input
            id="edit-apt-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Neighborhood, city"
          />
          {urlChanged ? (
            <p className="modal-note">
              Changing the URL will refresh availabilities from the new page and re-run the building profile.
              Past units stay in your history.
            </p>
          ) : nameChanged || locationChanged ? (
            <p className="modal-note">Name or location changes will refresh the building profile.</p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !hasChanges}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
