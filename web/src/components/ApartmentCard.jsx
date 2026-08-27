import { Link } from "react-router-dom";
import { isNewListing } from "@shared/listingView.js";
import { formatRelativeTime } from "../lib/format.js";
import { matchingListings } from "../lib/filters.js";
import { statusMeta } from "../lib/status.js";

export default function ApartmentCard({ apartment, filters }) {
  const listings = matchingListings(apartment, filters);
  const newCount = listings.filter((item) => isNewListing(item)).length;
  const status = statusMeta(apartment.status);

  return (
    <article className="apt-card">
      <div className="apt-card-top">
        <div>
          <h2 className="apt-name">{apartment.name}</h2>
          {apartment.location ? <p className="apt-location">{apartment.location}</p> : null}
        </div>
        {newCount > 0 ? <span className="badge badge-new">🔴 {newCount} NEW</span> : null}
      </div>

      <div className="unit-count">
        {listings.length} available unit{listings.length === 1 ? "" : "s"}
      </div>

      <div className="apt-meta">
        <span>Last checked: {formatRelativeTime(apartment.lastChecked)}</span>
        <span className={`status ${status.tone}`}>
          <span className="dot">{status.icon}</span>
          Status: {status.label}
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
