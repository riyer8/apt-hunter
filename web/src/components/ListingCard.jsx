import { Link } from "react-router-dom";
import { isNewListing, isPriceDrop, priceDropAmount } from "@shared/listingView.js";
import { formatAvailable, formatPrice, listingTitle, specLine } from "../lib/format.js";
import MatchBadge, { MatchDetails } from "./MatchBadge.jsx";
import BuildingScores, { BuildingNameLink } from "./BuildingScores.jsx";
import ListingSelectionActions, { ListingSelectionBadges } from "./ListingSelectionActions.jsx";

export default function ListingCard({
  listing,
  showBuilding = false,
  onSelectionChange,
  selectionBusy = false,
  compact = false,
}) {
  const inactive = listing.isActive === false;
  const isNew = !inactive && isNewListing(listing);
  const drop = !inactive && isPriceDrop(listing);
  const dropAmount = drop ? priceDropAmount(listing) : null;
  const specs = specLine(listing);

  return (
    <article
      className={[
        "listing-card",
        inactive ? "inactive" : null,
        compact ? "listing-card-compact" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="listing-card-head">
        <div>
          <h3 className="listing-title">
            {showBuilding && listing.apartmentName ? (
              <>
                <BuildingNameLink listing={listing} /> — {listingTitle(listing)}
              </>
            ) : (
              listingTitle(listing)
            )}
          </h3>
          <ListingSelectionBadges listing={listing} />
        </div>
        <div className="listing-card-flags">
          <MatchBadge match={listing.match} />
          {isNew ? <span className="badge badge-new">New</span> : null}{" "}
          {drop ? <span className="badge badge-drop">Price drop</span> : null}
          {inactive ? <span className="badge badge-removed">Out</span> : null}
        </div>
      </div>

      <p className="listing-price">
        {formatPrice(listing.price)}
        {listing.price != null ? <span className="listing-price-suffix">/mo</span> : null}
        {drop ? <s>{formatPrice(listing.previousPrice)}</s> : null}
      </p>

      {specs ? <p className="listing-specs">{specs}</p> : <p className="listing-specs">Details not listed</p>}
      <p className="listing-date">
        {formatAvailable(listing.availableDate)}
        {listing.floorPlan ? ` · ${listing.floorPlan}` : ""}
        {dropAmount ? ` · Down $${dropAmount.toLocaleString("en-US")}` : ""}
      </p>

      {!compact ? <MatchDetails match={listing.match} /> : null}
      {!compact ? <BuildingScores profile={listing.buildingProfile} compact /> : null}

      {onSelectionChange ? (
        <ListingSelectionActions
          listing={listing}
          onChange={onSelectionChange}
          disabled={selectionBusy}
          compact
        />
      ) : null}

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
