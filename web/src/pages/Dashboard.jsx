import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listingMatchesFilters,
  isNewListing,
  sortListings,
  sortListingsWithCuratedPriority,
} from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { apartmentVisible, hasActiveDashboardFilters, EMPTY_FILTERS } from "../lib/filters.js";
import { formatPrice, formatRelativeTime, listingTitle, parseIsoTime } from "../lib/format.js";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import { useApartmentActions } from "../hooks/useApartmentActions.js";
import { SF_BUILDINGS } from "@shared/sfBuildings.js";
import Shell from "../components/layout/Shell.jsx";
import FilterBar from "../components/listings/FilterBar.jsx";
import ListingsTable from "../components/listings/ListingsTable.jsx";
import StatStrip from "../components/common/StatStrip.jsx";
import AddApartmentModal from "../components/apartments/AddApartmentModal.jsx";

export default function Dashboard() {
  const { apartments, loading, source, addApartment, populateSfBuildings } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const [adding, setAdding] = useState(false);
  const [populateBusy, setPopulateBusy] = useState("");
  const [populateError, setPopulateError] = useState("");
  const { canManage, listingSelectionBusy, handleListingSelection } = useApartmentActions();

  const allListings = useMemo(
    () => apartments.flatMap((apartment) => apartment.listings || []),
    [apartments],
  );

  const filteredListings = useMemo(
    () =>
      sortListings(
        apartments
          .filter((apartment) => apartmentVisible(apartment, filters))
          .flatMap((apartment) =>
            (apartment.listings || [])
              .filter((listing) =>
                listingMatchesFilters(
                  { ...listing, apartmentName: listing.apartmentName || apartment.name },
                  filters,
                ),
              )
              .map((listing) => ({
                ...listing,
                apartmentId: apartment.id,
                apartmentName: listing.apartmentName || apartment.name,
                buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
              })),
          ),
        filters.sort,
        filters.sortDir,
      ),
    [apartments, filters],
  );

  const unitsMain = useMemo(
    () => sortListingsWithCuratedPriority(filteredListings, filters.sort, filters.sortDir),
    [filteredListings, filters.sort, filters.sortDir],
  );

  const newListings =
    source === "api"
      ? apartments.reduce((total, apartment) => total + (apartment.changeSummary?.new || 0), 0)
      : allListings.filter((listing) => isNewListing(listing)).length;
  const activeMonitors = apartments.filter((apartment) => apartment.monitorState === "active").length;
  const failedMonitors = apartments.filter(
    (apartment) => apartment.monitorState === "active" && (apartment.consecutiveFailures || 0) >= 3,
  ).length;
  const lastCheckedMs = apartments.reduce((latest, apartment) => {
    const time = parseIsoTime(apartment.lastChecked);
    if (time == null) return latest;
    return latest == null ? time : Math.max(latest, time);
  }, null);

  const bestMatches = useMemo(
    () =>
      filteredListings
        .filter((listing) => listing.match?.configured && listing.match.qualifies)
        .sort((left, right) => (right.match?.score || 0) - (left.match?.score || 0))
        .slice(0, 5),
    [filteredListings],
  );

  async function handlePopulateSf() {
    if (
      !window.confirm(
        `Replace all ${apartments.length} building${apartments.length === 1 ? "" : "s"} with the SF starter list (${SF_BUILDINGS.length} buildings)? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPopulateError("");
    setPopulateBusy(true);
    try {
      await populateSfBuildings();
    } catch (err) {
      setPopulateError(err.message || "Could not auto-populate.");
    } finally {
      setPopulateBusy(false);
    }
  }

  return (
    <Shell
      source={source}
      action={
        <div className="dashboard-actions">
          {canManage ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={populateBusy || loading}
              onClick={handlePopulateSf}
            >
              {populateBusy ? "Populating…" : "Auto-populate SF"}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add apartment
          </button>
        </div>
      }
    >
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview and every unit across your buildings.</p>
      </header>
      {populateError ? <p className="form-error">{populateError}</p> : null}

      <StatStrip
        items={[
          { key: "monitors", label: "Monitoring", value: loading ? "—" : activeMonitors },
          {
            key: "checked",
            label: "Last check",
            value: loading ? "—" : lastCheckedMs != null ? formatRelativeTime(new Date(lastCheckedMs).toISOString()) : "Never",
            small: true,
          },
          { key: "new", label: "New units", value: loading ? "—" : newListings, highlight: !loading && newListings > 0 },
          { key: "failed", label: "Errors", value: loading ? "—" : failedMonitors, highlight: !loading && failedMonitors > 0 },
        ]}
      />

      <FilterBar filters={filters} onChange={setFilters} showSort showApartmentSort />

      {hasActiveDashboardFilters(filters) && filteredListings.length < allListings.length ? (
        <p className="filter-notice">
          {allListings.length - filteredListings.length} of {allListings.length} units hidden.{" "}
          <button type="button" className="text-link" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            Clear
          </button>
        </p>
      ) : null}

      {bestMatches.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Best matches</h2>
            <p>
              <Link to="/preferences">Preferences</Link>
            </p>
          </div>
          <ol className="best-matches">
            {bestMatches.map((listing) => (
              <li key={listing.id || `${listing.apartmentId}-${listing.unit}`}>
                <Link to={`/apartments/${listing.apartmentId}`}>
                  <strong>
                    {listing.match.score}%{listing.match.profileName ? ` · ${listing.match.profileName}` : ""} — {listing.apartmentName} {listing.unit ? `Unit ${listing.unit}` : listingTitle(listing)}
                  </strong>
                  <span>
                    {formatPrice(listing.price)}
                    {listing.sqft ? ` · ${listing.sqft.toLocaleString("en-US")} sqft` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>All units</h2>
          <p>
            {unitsMain.length} unit{unitsMain.length === 1 ? "" : "s"}
            {" · "}
            <Link to="/changes">Recent changes</Link>
            {" · "}
            <Link to="/browse">Pinned &amp; saved</Link>
          </p>
        </div>
        {unitsMain.length === 0 ? (
          <div className="empty">
            {allListings.length === 0 ? (
              "No units yet — add a building to get started."
            ) : (
              <FilterEmptyState
                count={allListings.length}
                onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
              />
            )}
          </div>
        ) : (
          <ListingsTable
            listings={unitsMain}
            sortKey={filters.sort}
            sortDir={filters.sortDir}
            showBuilding
            onSort={(key) => setFilters(cycleSort(filters, key))}
            onSelectionChange={handleListingSelection}
            selectionBusyId={listingSelectionBusy}
          />
        )}
      </section>

      {adding ? <AddApartmentModal onClose={() => setAdding(false)} onAdd={addApartment} /> : null}
    </Shell>
  );
}

function FilterEmptyState({ count, onClearFilters }) {
  return (
    <div className="empty-filtered">
      <p>No matches — {count} units hidden by your filters.</p>
      <button type="button" className="btn btn-ghost btn-small" onClick={onClearFilters}>
        Clear filters
      </button>
    </div>
  );
}
