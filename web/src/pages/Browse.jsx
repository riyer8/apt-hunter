import { useMemo } from "react";
import { listingMatchesFilters, sortListingsWithCuratedPriority } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { apartmentVisible, hasActiveDashboardFilters, EMPTY_FILTERS } from "../lib/filters.js";
import { usePersistentFilters } from "../hooks/usePersistentFilters.js";
import { useApartmentActions } from "../hooks/useApartmentActions.js";
import { summarizeBuildings } from "../lib/dashboardSummaries.js";
import Shell from "../components/layout/Shell.jsx";
import FilterBar from "../components/listings/FilterBar.jsx";
import ApartmentCard from "../components/apartments/ApartmentCard.jsx";
import CuratedUnitsSection from "../components/listings/CuratedUnitsSection.jsx";
import CollapsibleSection from "../components/common/CollapsibleSection.jsx";

export default function Browse() {
  const { apartments, loading, source } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const { cardProps, listingSelectionBusy, handleListingSelection } = useApartmentActions();

  const visible = useMemo(
    () => apartments.filter((apartment) => apartmentVisible(apartment, { ...filters, selectionScope: "" })),
    [apartments, filters],
  );

  const favorites = useMemo(
    () => visible.filter((apartment) => apartment.isFavorite),
    [visible],
  );

  const tracking = useMemo(
    () => visible.filter((apartment) => apartment.isWatchlisted && !apartment.isFavorite),
    [visible],
  );

  const allBuildings = useMemo(
    () => visible.filter((apartment) => !apartment.isFavorite && !apartment.isWatchlisted),
    [visible],
  );

  const filteredListings = useMemo(
    () =>
      apartments
        .filter((apartment) => apartmentVisible(apartment, { ...filters, selectionScope: "" }))
        .flatMap((apartment) =>
          (apartment.listings || [])
            .filter((listing) =>
              listingMatchesFilters(
                { ...listing, apartmentName: listing.apartmentName || apartment.name },
                { ...filters, selectionScope: "" },
              ),
            )
            .map((listing) => ({
              ...listing,
              apartmentId: apartment.id,
              apartmentName: listing.apartmentName || apartment.name,
              buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
            })),
        ),
    [apartments, filters],
  );

  const favoriteUnits = useMemo(
    () => sortListingsWithCuratedPriority(
      filteredListings.filter((listing) => listing.isFavorite),
      filters.sort,
      filters.sortDir,
    ),
    [filteredListings, filters.sort, filters.sortDir],
  );

  const watchlistUnits = useMemo(
    () =>
      sortListingsWithCuratedPriority(
        filteredListings.filter((listing) => listing.isWatchlisted && !listing.isFavorite),
        filters.sort,
        filters.sortDir,
      ),
    [filteredListings, filters.sort, filters.sortDir],
  );

  const buildingsSummary = useMemo(() => summarizeBuildings(allBuildings), [allBuildings]);
  const allListings = useMemo(
    () => apartments.flatMap((apartment) => apartment.listings || []),
    [apartments],
  );

  return (
    <Shell source={source}>
      <header className="page-header">
        <h1 className="page-title">Browse</h1>
        <p className="page-subtitle">Pinned buildings, tracked units, and everything you’ve saved.</p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} showSort showApartmentSort />

      {hasActiveDashboardFilters(filters) && filteredListings.length < allListings.length ? (
        <p className="filter-notice">
          Filters apply to unit sections below.{" "}
          <button type="button" className="text-link" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            Clear
          </button>
        </p>
      ) : null}

      {favorites.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Pinned</h2>
            <p>{favorites.length} building{favorites.length === 1 ? "" : "s"}</p>
          </div>
          <div className="card-grid">
            {favorites.map((apartment) => (
              <ApartmentCard key={`fav-${apartment.id}`} {...cardProps(apartment, filters)} />
            ))}
          </div>
        </section>
      ) : null}

      {tracking.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Tracking</h2>
            <p>{tracking.length} building{tracking.length === 1 ? "" : "s"}</p>
          </div>
          <div className="card-grid">
            {tracking.map((apartment) => (
              <ApartmentCard key={`watch-${apartment.id}`} {...cardProps(apartment, filters)} />
            ))}
          </div>
        </section>
      ) : null}

      <CollapsibleSection
        title="All buildings"
        headline={buildingsSummary.headline}
        preview={allBuildings.length > 0 ? buildingsSummary.preview : null}
        defaultOpen={allBuildings.length <= 3}
        bodyClassName={allBuildings.length === 0 && !loading ? "" : "card-grid"}
      >
        {allBuildings.length === 0 && !loading ? (
          <div className="empty collapsible-section-empty">
            {apartments.length === 0 ? "No buildings yet." : "All buildings are pinned or tracking."}
          </div>
        ) : (
          allBuildings.map((apartment) => <ApartmentCard key={apartment.id} {...cardProps(apartment, filters)} />)
        )}
      </CollapsibleSection>

      {favoriteUnits.length > 0 ? (
        <CuratedUnitsSection
          title="Favorite units"
          listings={favoriteUnits}
          showBuilding
          compact
          defaultOpen
          onSelectionChange={handleListingSelection}
          selectionBusyId={listingSelectionBusy}
        />
      ) : null}

      {watchlistUnits.length > 0 ? (
        <CuratedUnitsSection
          title="Unit watchlist"
          listings={watchlistUnits}
          showBuilding
          compact
          defaultOpen
          onSelectionChange={handleListingSelection}
          selectionBusyId={listingSelectionBusy}
        />
      ) : null}

      {favorites.length === 0 &&
      tracking.length === 0 &&
      favoriteUnits.length === 0 &&
      watchlistUnits.length === 0 &&
      allBuildings.length === 0 &&
      !loading ? (
        <div className="empty">Nothing saved yet. Pin a building or favorite a unit from the dashboard.</div>
      ) : null}
    </Shell>
  );
}
