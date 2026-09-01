import { Link } from "react-router-dom";
import { isPriceDrop } from "@shared/listingView.js";
import { changeMeta } from "../../lib/changes.js";
import { formatAvailableShort, formatPrice, listingTitle, specLine } from "../../lib/format.js";
import MatchBadge from "./MatchBadge.jsx";
import { BuildingNameLink } from "../building/BuildingScores.jsx";
import ListingSelectionActions from "./ListingSelectionActions.jsx";

export default function ChangeListingCard({
  change,
  listing,
  onSelectionChange,
  selectionBusy = false,
}) {
  const inactive = listing.isActive === false || change?.changeType === "REMOVED";
  const drop = !inactive && (change?.changeType === "PRICE_DROP" || isPriceDrop(listing));
  const specs = specLine(listing);
  const availability = formatAvailableShort(listing.availableDate);
  const meta = [specs, availability !== "—" ? `Avail ${availability}` : null].filter(Boolean).join(" · ");
  const typeMeta = change ? changeMeta(change.changeType) : null;

  return (
    <article className={`listing-card listing-card-change${inactive ? " inactive" : ""}`}>
      <div className="change-card-head">
        <div className="change-card-ident">
          {listing.apartmentName ? <BuildingNameLink listing={listing} className="change-card-building" /> : null}
          <span className="change-card-unit">{listingTitle(listing)}</span>
        </div>
        <div className="change-card-badges tag-group">
          {typeMeta ? <span className={`badge ${typeMeta.className}`}>{typeMeta.label}</span> : null}
          <MatchBadge match={listing.match} scoreOnly />
        </div>
      </div>

      <div className="change-card-price">
        {inactive ? (
          <span className="tag-group">
            <span className="badge badge-removed">Removed</span>
          </span>
        ) : (
          <>
            <span className="change-card-price-now">
              {formatPrice(listing.price)}
              {listing.price != null ? <span className="listing-price-suffix">/mo</span> : null}
            </span>
            {drop && listing.previousPrice != null ? (
              <span className="change-card-price-was">
                <s>{formatPrice(listing.previousPrice)}</s>
              </span>
            ) : null}
          </>
        )}
      </div>

      {meta ? <p className="change-card-meta">{meta}</p> : null}

      <div className="change-card-footer">
        {onSelectionChange ? (
          <ListingSelectionActions
            listing={listing}
            onChange={onSelectionChange}
            disabled={selectionBusy}
            compact
          />
        ) : null}
        <div className="change-card-links">
          {listing.listingUrl ? (
            <a href={listing.listingUrl} target="_blank" rel="noreferrer">
              Listing
            </a>
          ) : null}
          <Link
            to={`/apartments/${listing.apartmentId}${listing.unit ? `?unit=${encodeURIComponent(listing.unit)}` : ""}`}
          >
            Building
          </Link>
        </div>
      </div>
    </article>
  );
}
