import { Link } from "react-router-dom";
import { isNewListing, isPriceDrop } from "@shared/listingView.js";
import {
  formatAvailableShort,
  formatBedsShort,
  formatPriceShort,
  listingTitle,
} from "../lib/format.js";

const COLUMNS = [
  { key: "building", label: "Building" },
  { key: "unit", label: "Unit" },
  { key: "price", label: "Price", numeric: true },
  { key: "beds", label: "Beds", numeric: true },
  { key: "sqft", label: "Sqft", numeric: true },
  { key: "availability", label: "Available" },
];

export default function ListingsTable({
  listings,
  sortKey = "unit",
  sortDir = "",
  onSort,
  showBuilding = false,
}) {
  const columns = COLUMNS.filter((column) => showBuilding || column.key !== "building");
  const resolvedDir = sortDir || (sortKey === "newest" || sortKey === "changed" ? "desc" : "asc");

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
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const isNew = isNewListing(listing);
            const drop = isPriceDrop(listing);
            const unitLabel = listing.unit || listing.floorPlan || listingTitle(listing);
            const unit = listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noreferrer">
                {unitLabel}
              </a>
            ) : (
              unitLabel
            );

            return (
              <tr key={listing.id || `${listing.apartmentId}-${unitLabel}`}>
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
                  {unit}
                  {isNew ? <span className="badge badge-new">NEW</span> : null}
                  {drop ? <span className="badge badge-drop">Drop</span> : null}
                </td>
                <td className="num">
                  {formatPriceShort(listing.price)}
                  {drop ? <s>{formatPriceShort(listing.previousPrice)}</s> : null}
                </td>
                <td className="num">{formatBedsShort(listing.bedrooms)}</td>
                <td className="num">{listing.sqft == null ? "—" : listing.sqft.toLocaleString("en-US")}</td>
                <td>{formatAvailableShort(listing.availableDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
