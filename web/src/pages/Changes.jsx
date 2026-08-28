import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listChanges } from "../api/apartments.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { CHANGE_TYPES, changeMeta, formatChangeValues } from "../lib/changes.js";
import { formatRelativeTime } from "../lib/format.js";
import Shell from "../components/Shell.jsx";

export default function Changes() {
  const { apartments, loading, source } = useApartments();
  const [changes, setChanges] = useState([]);
  const [type, setType] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    listChanges({ apartmentId: apartmentId || undefined, type: type || undefined })
      .then((rows) => {
        if (!cancelled) setChanges(rows);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apartmentId, type, apartments, source]);

  const counts = useMemo(() => {
    const tally = Object.fromEntries(CHANGE_TYPES.map((key) => [key, 0]));
    for (const change of changes) {
      if (tally[change.changeType] != null) tally[change.changeType] += 1;
    }
    return tally;
  }, [changes]);

  return (
    <Shell source={source}>
      <h1 className="page-title">Recent changes</h1>

      <div className="toolbar">
        <div className="filters" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <label className="field">
            <span>Change type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              {CHANGE_TYPES.map((key) => (
                <option key={key} value={key}>
                  {changeMeta(key).emoji} {changeMeta(key).label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Apartment</span>
            <select value={apartmentId} onChange={(event) => setApartmentId(event.target.value)}>
              <option value="">All apartments</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="stats stats-changes">
        {CHANGE_TYPES.map((key) => (
          <div className="stat" key={key}>
            <div className="stat-value">{ready ? counts[key] : "—"}</div>
            <div className="stat-label">
              {changeMeta(key).emoji} {changeMeta(key).label}
            </div>
          </div>
        ))}
      </section>

      {!ready || loading ? (
        <p className="lede">Loading…</p>
      ) : changes.length === 0 ? (
        <div className="empty">None</div>
      ) : (
        <div className="change-list">
          {changes.map((change) => {
            const meta = changeMeta(change.changeType);
            return (
              <article key={change.id} className="change-row">
                <span className={`badge ${meta.className}`}>
                  {meta.emoji} {meta.label}
                </span>
                <div>
                  <h2 className="change-title">
                    {change.apartmentName}
                    {change.unit ? ` · Unit ${change.unit}` : ""}
                  </h2>
                  <p className="change-values">{formatChangeValues(change)}</p>
                  <p className="change-when">{formatRelativeTime(change.detectedAt)}</p>
                </div>
                <div className="change-actions">
                  <Link to={`/apartments/${change.apartmentId}`}>Apartment</Link>
                  {change.listingUrl ? (
                    <a href={change.listingUrl} target="_blank" rel="noreferrer">
                      Listing
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
