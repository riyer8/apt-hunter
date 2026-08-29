import { useState } from "react";
import { isValidHttpUrl } from "../../lib/format.js";

export default function AddApartmentModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidHttpUrl(url.trim())) {
      setError("Enter a valid http:// or https:// availability URL.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({ name: name.trim(), url: url.trim() });
      onClose();
    } catch (err) {
      setError(err.message || "Could not add that apartment.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="add-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-title">Add apartment</h2>
        <form className="modal-form" onSubmit={submit}>
          <label htmlFor="apt-name">Building name</label>
          <input
            id="apt-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Building name"
          />
          <label htmlFor="apt-url">Availability URL</label>
          <input
            id="apt-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            required
          />
          {error ? <p className="error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Adding…" : "Add apartment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
