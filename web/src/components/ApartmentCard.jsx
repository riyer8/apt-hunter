import { Link } from "react-router-dom";
import { apartmentChangeSummary } from "../lib/changes.js";
import { formatRelativeTime, formatUntil } from "../lib/format.js";
import { matchingListings } from "../lib/filters.js";
import { changeCount, monitorMeta } from "../lib/status.js";
import { OverallScore } from "./BuildingScores.jsx";
import ApartmentSelectionActions, { SelectionBadges } from "./ApartmentSelectionActions.jsx";

export default function ApartmentCard({
  apartment,
  filters,
  onSelectionChange,
  selectionBusy = false,
  onAnalyze,
  onDelete,
  analyzeBusy = false,
  deleteBusy = false,
  showActions = true,
}) {
  const listings = matchingListings(apartment, filters);
  const totalListings = (apartment.listings || []).length;
  const summary = apartmentChangeSummary(apartment);
  const monitor = monitorMeta(apartment);
  const changes = changeCount({ changeSummary: summary });
  const analyzing = apartment.status === "Analyzing…" || analyzeBusy;

  return (
    <article className="apt-card">
      <div className="apt-card-top">
        <div>
          <h2 className="apt-name">
            <Link to={`/apartments/${apartment.id}`}>{apartment.name}</Link>
          </h2>
          {apartment.location ? <p className="apt-location">{apartment.location}</p> : null}
          <SelectionBadges item={apartment} />
        </div>
        <span className={`status ${monitor.tone}`}>
          <span className="dot">{monitor.icon}</span>
          {monitor.label}
        </span>
      </div>

      <div className="apt-meta">
        <span>Last checked {formatRelativeTime(apartment.lastChecked)}</span>
        <span>
          Next check {apartment.monitorState === "active" ? formatUntil(apartment.nextScrapeAt) : "paused"}
        </span>
        <span>
          {totalListings} listing{totalListings === 1 ? "" : "s"}
          {listings.length !== totalListings
            ? ` (${listings.length} match filters)`
            : ""}
          {changes ? ` · ${changes} change${changes === 1 ? "" : "s"}` : ""}
        </span>
        {apartment.buildingProfile ? (
          <span>
            Overall <OverallScore profile={apartment.buildingProfile} />
          </span>
        ) : null}
      </div>

      {onSelectionChange ? (
        <ApartmentSelectionActions
          apartment={apartment}
          onChange={onSelectionChange}
          disabled={selectionBusy}
          compact
        />
      ) : null}

      {showActions ? (
        <div className="apt-card-actions">
          {onAnalyze ? (
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={analyzing || deleteBusy}
              onClick={() => onAnalyze(apartment)}
            >
              {analyzing ? "Analyzing…" : "Analyze"}
            </button>
          ) : null}
          <Link className="btn btn-ghost btn-small" to={`/apartments/${apartment.id}`}>
            View listings
          </Link>
          <a className="btn btn-ghost btn-small" href={apartment.url} target="_blank" rel="noreferrer">
            Open page
          </a>
          {onDelete ? (
            <button
              type="button"
              className="btn btn-ghost btn-small danger-text"
              disabled={analyzing || deleteBusy}
              onClick={() => onDelete(apartment)}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="apt-card-footer">
          <a className="source-link" href={apartment.url} target="_blank" rel="noreferrer">
            Availability page
          </a>
          <Link className="btn btn-ghost btn-small" to={`/apartments/${apartment.id}`}>
            View listings
          </Link>
        </div>
      )}
    </article>
  );
}
