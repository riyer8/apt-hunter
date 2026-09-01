import { useEffect, useMemo, useState } from "react";
import { listChanges } from "../api/apartments.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { CHANGE_TYPES, changeMeta } from "../lib/changes.js";
import {
  countChangesByType,
  filterRecentChanges,
  listingForChange,
  listingLookup,
} from "../lib/changeListings.js";
import { summarizeListings } from "../lib/dashboardSummaries.js";
import Shell from "../components/layout/Shell.jsx";
import ChangeListingCard from "../components/listings/ChangeListingCard.jsx";
import { useApartmentActions } from "../hooks/useApartmentActions.js";

export default function Changes() {
  const { apartments, loading, source } = useApartments();
  const [changes, setChanges] = useState([]);
  const [type, setType] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [ready, setReady] = useState(false);
  const { listingSelectionBusy, handleListingSelection } = useApartmentActions();

  const lookup = useMemo(() => listingLookup(apartments), [apartments]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    listChanges({ apartmentId: apartmentId || undefined, limit: 500 })
      .then((rows) => {
        if (!cancelled) setChanges(rows);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apartmentId, apartments, source]);

  const recentChanges = useMemo(() => filterRecentChanges(changes), [changes]);
  const counts = useMemo(() => countChangesByType(recentChanges), [recentChanges]);

  const items = useMemo(() => {
    let rows = recentChanges;
    if (type) rows = rows.filter((change) => change.changeType === type);
    return rows.map((change) => ({
      change,
      listing: listingForChange(change, lookup),
    }));
  }, [recentChanges, type, lookup]);

  const summary = useMemo(() => summarizeListings(items.map((item) => item.listing)), [items]);

  return (
    <Shell source={source}>
      <header className="page-header">
        <h1 className="page-title">Changes</h1>
        <p className="page-subtitle">
          {summary.headline || "Units that changed in the last 48 hours."}
        </p>
      </header>

      <div className="change-filters">
        <div className="change-type-tabs" role="tablist" aria-label="Change type">
          <button
            type="button"
            role="tab"
            aria-selected={type === ""}
            className={`change-type-tab${type === "" ? " active" : ""}`}
            onClick={() => setType("")}
          >
            All
            {!loading && ready ? <span>{recentChanges.length}</span> : null}
          </button>
          {CHANGE_TYPES.map((key) => {
            const meta = changeMeta(key);
            const count = loading || !ready ? null : counts[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={type === key}
                className={[
                  "change-type-tab",
                  type === key ? "active" : "",
                  count > 0 ? "has-count" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setType(type === key ? "" : key)}
              >
                {meta.label}
                {count != null ? <span>{count}</span> : null}
              </button>
            );
          })}
        </div>
        <label className="filter-group filter-group-select">
          <span className="filter-group-label">Building</span>
          <select className="filter-input" value={apartmentId} onChange={(event) => setApartmentId(event.target.value)}>
            <option value="">All buildings</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!ready || loading ? (
        <p className="page-loading">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty">No recent changes match these filters.</div>
      ) : (
        <div className="changed-rail changes-rail">
          {items.map(({ change, listing }) => (
            <ChangeListingCard
              key={change.id}
              change={change}
              listing={listing}
              onSelectionChange={
                handleListingSelection && listing.id
                  ? (patch) => handleListingSelection(listing.id, patch)
                  : undefined
              }
              selectionBusy={listingSelectionBusy === listing.id}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}
