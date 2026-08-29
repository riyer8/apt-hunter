import { Link } from "react-router-dom";
import { DESC_SORT_KEYS } from "@shared/listingView.js";
import { isNewListing, isPriceDrop } from "@shared/listingView.js";
import {
  formatAvailableShort,
  formatBedsBathsShort,
  formatPriceShort,
  listingTitle,
} from "../lib/format.js";
import MatchBadge from "./MatchBadge.jsx";
import { OverallScore } from "./BuildingScores.jsx";
import ListingSelectionActions from "./ListingSelectionActions.jsx";

const COLUMNS = [
  { key: "building", label: "Building" },
  { key: "unit", label: "Unit" },
  { key: "match", label: "Match", numeric: true },
  { key: "overall", label: "Bldg score", numeric: true },
  { key: "price", label: "Price", numeric: true },
  { key: "beds", label: "Bed / Bath", numeric: true },
  { key: "sqft", label: "Sqft", numeric: true },
  { key: "availability", label: "Available" },
];

export default function ListingsTable({
  listings,
  sortKey = "unit",
  sortDir = "",
  onSort,
  showBuilding = false,
  onSelectionChange,
  selectionBusyId = "",
}) {
  const columns = COLUMNS.filter((column) => showBuilding || column.key !== "building");
  const resolvedDir = sortDir || (DESC_SORT_KEYS.has(sortKey) ? "desc" : "asc");
  const showSelection = Boolean(onSelectionChange);

  return (
    <div className="listings-table-wrap">
      <table className="listings-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sortKey === column.key;
              return (
                <th
                  key={column.key}
                  className={column.numeric ? "num" : undefined}
                  aria-sort={active ? (resolvedDir === "desc" ? "descending" : "ascending") : "none"}
                >
                  <button type="button" onClick={() => onSort?.(column.key)}>
                    {column.label}
                    {active ? (resolvedDir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              );
            })}
            {showSelection ? <th>Curate</th> : null}
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const inactive = listing.isActive === false;
            const isNew = !inactive && isNewListing(listing);
            const drop = !inactive && isPriceDrop(listing);
            const unitLabel = listing.unit || listing.floorPlan || listingTitle(listing);
            const unit = !inactive && listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noreferrer">
                {unitLabel}
              </a>
            ) : (
              unitLabel
            );

            const rowClass = inactive
              ? "listing-row-inactive"
              : listing.isFavorite
                ? "listing-row-favorite"
                : listing.isWatchlisted
                  ? "listing-row-watchlist"
                  : undefined;

            return (
              <tr key={listing.id || `${listing.apartmentId}-${unitLabel}`} className={rowClass}>
                {showBuilding ? (
                  <td>
                    {listing.apartmentId ? (
                      <Link to={`/apartments/${listing.apartmentId}`}>{listing.apartmentName || "Building"}</Link>
                    ) : (
                      listing.apartmentName || "—"
                    )}
                  </td>
                ) : null}
                <td>
                  <span className="listing-unit-cell">
                    {listing.isFavorite ? (
                      <span className="listing-curate-mark favorite" title="Favorite">
                        ★
                      </span>
                    ) : null}
                    {listing.isWatchlisted ? (
                      <span className="listing-curate-mark watchlist" title="Watchlist">
                        👁
                      </span>
                    ) : null}
                    {unit}
                  </span>
                  {inactive ? <span className="badge badge-removed">Out</span> : null}
                  {isNew ? <span className="badge badge-new">New</span> : null}
                  {drop ? <span className="badge badge-drop">Price drop</span> : null}
                </td>
                <td className="num">
                  <MatchBadge match={listing.match} />
                </td>
                <td className="num">
                  <OverallScore profile={listing.buildingProfile} />
                </td>
                <td className="num">
                  {formatPriceShort(listing.price)}
                  {drop ? <s>{formatPriceShort(listing.previousPrice)}</s> : null}
                </td>
                <td className="num">{formatBedsBathsShort(listing)}</td>
                <td className="num">{listing.sqft == null ? "—" : listing.sqft.toLocaleString("en-US")}</td>
                <td>{formatAvailableShort(listing.availableDate)}</td>
                {showSelection ? (
                  <td className="listing-selection-cell">
                    <ListingSelectionActions
                      listing={listing}
                      compact
                      disabled={selectionBusyId === listing.id}
                      onChange={(patch) => onSelectionChange(listing.id, patch)}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
