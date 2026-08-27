import { useMemo, useState } from "react";
import { listingMatchesFilters, isNewListing, isPriceDrop, isRecentlyChanged, sortListings } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { apartmentVisible } from "../lib/filters.js";
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
            })),
        ),
        filters.sort,
        filters.sortDir,
      ),
    [apartments, filters],
  );

  const newCount = allListings.filter((listing) => isNewListing(listing)).length;
  const dropCount = allListings.filter((listing) => isPriceDrop(listing)).length;
  const recent = filteredListings
    .filter((listing) => isRecentlyChanged(listing))
    .sort((left, right) => Date.parse(right.lastSeen || 0) - Date.parse(left.lastSeen || 0))
    .slice(0, 6);

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
        {source === "extension"
          ? "This dashboard reads the same saved list as the Chrome extension. Analyze a page in the popup to refresh units here."
          : "Showing sample data. Load the AptWatch extension and open this page to see your apartments."}
      </p>

      <section className="stats">
        <div className="stat">
          <div className="stat-value">{loading ? "—" : apartments.length}</div>
          <div className="stat-label">Apartments monitored</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? "—" : allListings.length}</div>
          <div className="stat-label">Available units</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? "—" : newCount}</div>
          <div className="stat-label">New listings</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? "—" : dropCount}</div>
          <div className="stat-label">Price drops</div>
        </div>
      </section>

      <FilterBar filters={filters} onChange={setFilters} showSort />

      {recent.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Recently changed</h2>
            <p>New units and updates from the latest checks</p>
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
              ? source === "extension"
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
          connected={source === "extension"}
          onClose={() => setAdding(false)}
          onAdd={addApartment}
        />
      ) : null}
    </Shell>
  );
}
