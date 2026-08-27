import { Link } from "react-router-dom";
import { apartmentChangeSummary } from "../lib/changes.js";
import { formatRelativeTime, formatUntil } from "../lib/format.js";
import { matchingListings } from "../lib/filters.js";
import { changeCount, monitorMeta } from "../lib/status.js";

export default function ApartmentCard({ apartment, filters }) {
  const listings = matchingListings(apartment, filters);
  const summary = apartmentChangeSummary(apartment);
  const monitor = monitorMeta(apartment);
  const changes = changeCount({ changeSummary: summary });

  return (
    <article className="apt-card">
      <div className="apt-card-top">
        <div>
          <h2 className="apt-name">{apartment.name}</h2>
          {apartment.location ? <p className="apt-location">{apartment.location}</p> : null}
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
          {listings.length} listing{listings.length === 1 ? "" : "s"}
          {changes ? ` · ${changes} change${changes === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div className="apt-card-footer">
        <a className="source-link" href={apartment.url} target="_blank" rel="noreferrer">
          Availability page
        </a>
        <Link className="btn btn-ghost btn-small" to={`/apartments/${apartment.id}`}>
          View listings
        </Link>
      </div>
    </article>
  );
}
