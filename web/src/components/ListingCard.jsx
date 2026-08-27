import { Link } from "react-router-dom";
import { isNewListing, isPriceDrop, priceDropAmount } from "@shared/listingView.js";
import { formatAvailable, formatPrice, listingTitle, specLine } from "../lib/format.js";

export default function ListingCard({ listing, showBuilding = false }) {
  const isNew = isNewListing(listing);
  const drop = isPriceDrop(listing);
  const dropAmount = priceDropAmount(listing);
  const specs = specLine(listing);

  return (
    <article className="listing-card">
      <div className="listing-card-head">
        <div>
          <h3 className="listing-title">{listingTitle(listing)}</h3>
          {showBuilding && listing.apartmentName ? (
            <p className="listing-building">{listing.apartmentName}</p>
          ) : null}
        </div>
        <div>
          {isNew ? <span className="badge badge-new">🆕 NEW</span> : null}{" "}
          {drop ? <span className="badge badge-drop">Price drop</span> : null}
        </div>
      </div>

      <p className="listing-price">
        {formatPrice(listing.price)}
        {listing.price != null ? <span style={{ fontSize: 16, color: "var(--muted)" }}>/mo</span> : null}
        {drop ? <s>{formatPrice(listing.previousPrice)}</s> : null}
      </p>

      {specs ? <p className="listing-specs">{specs}</p> : <p className="listing-specs">Details not listed</p>}
      <p className="listing-date">{formatAvailable(listing.availableDate)}</p>
      {listing.floorPlan ? <p className="listing-date">{listing.floorPlan}</p> : null}
      {dropAmount ? <p className="listing-date">Down ${dropAmount.toLocaleString("en-US")}</p> : null}

      <div className="listing-actions">
        {listing.listingUrl ? (
          <a className="btn btn-primary btn-small" href={listing.listingUrl} target="_blank" rel="noreferrer">
            View listing
          </a>
        ) : null}
        {showBuilding ? (
          <Link className="btn btn-ghost btn-small" to={`/apartments/${listing.apartmentId}`}>
            Building
          </Link>
        ) : null}
      </div>
    </article>
  );
}
