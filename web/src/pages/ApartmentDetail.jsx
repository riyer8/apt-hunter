import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listingMatchesFilters, sortListings } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import { formatRelativeTime } from "../lib/format.js";
import { statusMeta } from "../lib/status.js";
import Shell from "../components/Shell.jsx";
import FilterBar from "../components/FilterBar.jsx";
import ListingsTable from "../components/ListingsTable.jsx";

export default function ApartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apartments, loading, source, removeApartment } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const apartment = apartments.find((item) => item.id === id);
  const status = apartment ? statusMeta(apartment.status) : null;

  const listings = useMemo(() => {
    if (!apartment) return [];
    return sortListings(
      (apartment.listings || []).filter((listing) => listingMatchesFilters(listing, filters)),
      filters.sort,
      filters.sortDir,
    );
  }, [apartment, filters]);

  if (!loading && !apartment) {
    return (
      <Shell source={source}>
        <div className="empty">
          That building isn’t on your list. <Link to="/">Back to dashboard</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell source={source}>
      <Link className="back" to="/">
        ← All apartments
      </Link>

      {apartment ? (
        <>
          <div className="detail-hero">
            <div>
              <h1 className="page-title">{apartment.name}</h1>
              {apartment.location ? <p className="lede">{apartment.location}</p> : null}
              <p className={`status ${status.tone}`}>
                <span className="dot">{status.icon}</span>
                {status.label}
                <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                  {" "}
                  · Last checked {formatRelativeTime(apartment.lastChecked)}
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn btn-ghost" href={apartment.url} target="_blank" rel="noreferrer">
                Availability page
              </a>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  await removeApartment(apartment.id);
                  navigate("/");
                }}
              >
                Remove
              </button>
            </div>
          </div>

          <FilterBar filters={filters} onChange={setFilters} showSort />

          {listings.length === 0 ? (
            <div className="empty">
              {apartment.listings.length === 0
                ? source === "api" || source === "extension"
                  ? "No units yet. Analyze this page in the AptWatch popup."
                  : "No units yet."
                : "No units match those filters."}
            </div>
          ) : (
            <ListingsTable
              listings={listings}
              sortKey={filters.sort}
              sortDir={filters.sortDir}
              onSort={(key) => setFilters(cycleSort(filters, key))}
            />
          )}
        </>
      ) : (
        <p className="lede">Loading…</p>
      )}
    </Shell>
  );
}
