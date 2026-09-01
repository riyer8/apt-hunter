import { DESC_SORT_KEYS, isNewListing, isPriceDrop, priceDropAmount } from "@shared/listingView.js";
import {
  formatAvailableShort,
  formatBedsBathsShort,
  formatPriceShort,
  listingTitle,
} from "../../lib/format.js";
import MatchBadge from "./MatchBadge.jsx";
import { BuildingNameLink, OverallScore } from "../building/BuildingScores.jsx";
import ListingSelectionActions from "./ListingSelectionActions.jsx";

const COLUMNS = [
  { key: "building", label: "Apartment" },
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
  highlightUnit = "",
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
                  className={[
                    column.numeric ? "num" : undefined,
                    showBuilding && column.key === "building" ? "listings-table-apartment" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
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
            const dropAmount = drop ? priceDropAmount(listing) : null;
            const unitLabel = listing.unit || listing.floorPlan || listingTitle(listing);
            const unit = !inactive && listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noreferrer">
                {unitLabel}
              </a>
            ) : (
              unitLabel
            );

            const rowClass = [
              inactive ? "listing-row-inactive" : "",
              highlightUnit && String(listing.unit || "") === String(highlightUnit) ? "listing-row-highlight" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <tr key={listing.id || `${listing.apartmentId}-${unitLabel}`} className={rowClass}>
                {showBuilding ? (
                  <td className="listings-table-apartment">
                    {listing.apartmentName ? <BuildingNameLink listing={listing} /> : "—"}
                  </td>
                ) : null}
                <td>
                  <div className="listing-unit-wrap">
                    <span className="listing-unit-cell">
                      {listing.isFavorite ? (
                        <span className="listing-curate-mark favorite" title="Favorite">
                          F
                        </span>
                      ) : null}
                      {listing.isWatchlisted ? (
                        <span className="listing-curate-mark watchlist" title="Watchlist">
                          W
                        </span>
                      ) : null}
                      {unit}
                    </span>
                    {inactive || isNew ? (
                      <span className="tag-group">
                        {inactive ? <span className="badge badge-removed">Out</span> : null}
                        {isNew ? <span className="badge badge-new">New</span> : null}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="num">
                  <MatchBadge match={listing.match} />
                </td>
                <td className="num">
                  <OverallScore profile={listing.buildingProfile} />
                </td>
                <td className={`num${drop ? " listing-price-drop" : ""}`}>
                  <span className="listing-price-cell">
                    {formatPriceShort(listing.price)}
                    {drop ? (
                      <span className="listing-price-drop-meta">
                        <s>{formatPriceShort(listing.previousPrice)}</s>
                        {dropAmount ? <span className="listing-price-drop-delta">−${dropAmount.toLocaleString("en-US")}</span> : null}
                      </span>
                    ) : null}
                  </span>
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
