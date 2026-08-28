import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listingMatchesFilters, isNewListing, isRecentlyChanged, sortListings } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { apartmentVisible } from "../lib/filters.js";
import { formatPrice, formatRelativeTime, listingTitle } from "../lib/format.js";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import Shell from "../components/Shell.jsx";
import FilterBar from "../components/FilterBar.jsx";
import ApartmentCard from "../components/ApartmentCard.jsx";
import ListingCard from "../components/ListingCard.jsx";
import ListingsTable from "../components/ListingsTable.jsx";
import AddApartmentModal from "../components/AddApartmentModal.jsx";

export default function Dashboard() {
  const { apartments, loading, source, addApartment } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const [adding, setAdding] = useState(false);

  const visible = useMemo(
    () => apartments.filter((apartment) => apartmentVisible(apartment, filters)),
    [apartments, filters],
  );

  const allListings = useMemo(
    () => apartments.flatMap((apartment) => apartment.listings || []),
    [apartments],
  );

  const filteredListings = useMemo(
    () =>
      sortListings(
        apartments.flatMap((apartment) =>
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

  const newListings =
    source === "api"
      ? apartments.reduce((total, apartment) => total + (apartment.changeSummary?.new || 0), 0)
      : allListings.filter((listing) => isNewListing(listing)).length;
  const activeMonitors = apartments.filter((apartment) => apartment.monitorState === "active").length;
  const failedMonitors = apartments.filter(
    (apartment) => apartment.monitorState === "active" && (apartment.consecutiveFailures || 0) >= 3,
  ).length;
  const lastCheckedMs = apartments.reduce((latest, apartment) => {
    const time = Date.parse(apartment.lastChecked || 0);
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
  const recent = filteredListings
    .filter((listing) => isRecentlyChanged(listing))
    .sort((left, right) => Date.parse(right.lastSeen || 0) - Date.parse(left.lastSeen || 0))
    .slice(0, 6);

  const bestMatches = useMemo(
    () =>
      filteredListings
        .filter((listing) => listing.match?.configured && listing.match.qualifies)
        .sort((left, right) => (right.match?.score || 0) - (left.match?.score || 0))
        .slice(0, 5),
    [filteredListings],
  );

  return (
    <Shell
      source={source}
      action={
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add apartment
        </button>
      }
    >
      <h1 className="page-title">Your buildings, at a glance.</h1>
      <p className="lede">
        {source === "api"
          ? "The backend checks availability pages on a 30-minute schedule. Start monitoring on a building, or use Scrape Now."
          : source === "extension"
            ? "This dashboard reads the same saved list as the Chrome extension. Analyze a page in the popup to refresh units here."
            : "Showing sample data. Start the backend or load the AptWatch extension to see real apartments."}
      </p>

      <section className="stats">
        <div className="stat">
          <div className="stat-value">{loading ? "—" : activeMonitors}</div>
          <div className="stat-label">Active monitors</div>
        </div>
        <div className="stat">
          <div className="stat-value stat-value-fit">
            {loading ? "—" : lastCheckedMs ? formatRelativeTime(new Date(lastCheckedMs).toISOString()) : "Never"}
          </div>
          <div className="stat-label">Last checked</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? "—" : newListings}</div>
          <div className="stat-label">New listings</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? "—" : failedMonitors}</div>
          <div className="stat-label">Failed monitors</div>
        </div>
      </section>

      <FilterBar filters={filters} onChange={setFilters} showSort />

      {bestMatches.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>🔥 Best matches</h2>
            <p>
              Sorted by preference score · <Link to="/preferences">Edit preferences</Link>
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

      {recent.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Recently changed</h2>
            <p>
              New units and updates from the latest checks · <Link to="/changes">See all changes</Link>
            </p>
          </div>
          <div className="changed-rail">
            {recent.map((listing) => (
              <ListingCard key={listing.id} listing={listing} showBuilding />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>Monitored apartments</h2>
          <p>
            {visible.length} building{visible.length === 1 ? "" : "s"}
          </p>
        </div>
        {visible.length === 0 && !loading ? (
          <div className="empty">
            {apartments.length === 0
              ? "No apartments yet. Add one here or in the extension popup."
              : "No buildings match those filters."}
          </div>
        ) : (
          <div className="card-grid">
            {visible.map((apartment) => (
              <ApartmentCard key={apartment.id} apartment={apartment} filters={filters} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>All units</h2>
          <p>
            {filteredListings.length} matching unit{filteredListings.length === 1 ? "" : "s"} · click a column to sort
          </p>
        </div>
        {filteredListings.length === 0 ? (
          <div className="empty">
            {allListings.length === 0
              ? source === "api" || source === "extension"
                ? "No units yet. Open the extension, then Analyze an availability page."
                : "No units yet."
              : "No units match those filters."}
          </div>
        ) : (
          <ListingsTable
            listings={filteredListings}
            sortKey={filters.sort}
            sortDir={filters.sortDir}
            showBuilding
            onSort={(key) => setFilters(cycleSort(filters, key))}
          />
        )}
      </section>

      {adding ? (
        <AddApartmentModal
          connected={source === "api" || source === "extension"}
          onClose={() => setAdding(false)}
          onAdd={addApartment}
        />
      ) : null}
    </Shell>
  );
}
