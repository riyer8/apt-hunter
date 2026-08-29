import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listingMatchesFilters,
  isNewListing,
  isRecentlyChanged,
  sortListings,
  sortListingsWithCuratedPriority,
} from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { apartmentVisible, apartmentIncludedInListings, hasActiveDashboardFilters, EMPTY_FILTERS } from "../lib/filters.js";
import { formatPrice, formatRelativeTime, listingTitle } from "../lib/format.js";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import Shell from "../components/Shell.jsx";
import FilterBar from "../components/FilterBar.jsx";
import ApartmentCard from "../components/ApartmentCard.jsx";
import ListingCard from "../components/ListingCard.jsx";
import ListingsTable from "../components/ListingsTable.jsx";
import AddApartmentModal from "../components/AddApartmentModal.jsx";

export default function Dashboard() {
  const {
    apartments,
    loading,
    source,
    addApartment,
    removeApartment,
    setApartmentSelection,
    setListingSelection,
    scrapeNow,
    analyzeApartment,
  } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const [adding, setAdding] = useState(false);
  const [selectionBusy, setSelectionBusy] = useState("");
  const [listingSelectionBusy, setListingSelectionBusy] = useState("");
  const [analyzeBusy, setAnalyzeBusy] = useState("");
  const [scrapeBusy, setScrapeBusy] = useState("");
  const [deleteBusy, setDeleteBusy] = useState("");
  const canManage = source === "api" || source === "extension";

  const visible = useMemo(
    () => apartments.filter((apartment) => apartmentVisible(apartment, filters)),
    [apartments, filters],
  );

  const favorites = useMemo(
    () =>
      !filters.selectionScope
        ? apartments.filter(
            (apartment) => apartment.isFavorite && apartmentVisible(apartment, { ...filters, selectionScope: "" }),
          )
        : [],
    [apartments, filters],
  );

  const watchlist = useMemo(
    () =>
      !filters.selectionScope
        ? apartments.filter(
            (apartment) =>
              apartment.isWatchlisted &&
              !apartment.isFavorite &&
              apartmentVisible(apartment, { ...filters, selectionScope: "" }),
          )
        : [],
    [apartments, filters],
  );

  const visibleMain = useMemo(
    () =>
      filters.selectionScope
        ? visible
        : visible.filter((apartment) => !apartment.isFavorite && !apartment.isWatchlisted),
    [visible, filters.selectionScope],
  );

  async function handleListingSelection(id, patch) {
    setListingSelectionBusy(id);
    try {
      await setListingSelection(id, patch);
    } catch (error) {
      window.alert(error?.message || "Could not update that unit.");
    } finally {
      setListingSelectionBusy("");
    }
  }

  async function handleSelectionChange(id, patch) {
    setSelectionBusy(id);
    try {
      await setApartmentSelection(id, patch);
    } catch (error) {
      window.alert(error?.message || "Could not update that building.");
    } finally {
      setSelectionBusy("");
    }
  }

  async function handleScrape(apartment) {
    setScrapeBusy(apartment.id);
    try {
      if (source === "api") {
        await scrapeNow(apartment.id);
      } else {
        await analyzeApartment(apartment);
      }
    } catch (error) {
      window.alert(error?.message || "Refresh failed.");
    } finally {
      setScrapeBusy("");
    }
  }

  async function handleAnalyze(apartment) {
    setAnalyzeBusy(apartment.id);
    try {
      await analyzeApartment(apartment);
    } catch (error) {
      window.alert(error?.message || "Analyze failed.");
    } finally {
      setAnalyzeBusy("");
    }
  }

  async function handleDelete(apartment) {
    if (!window.confirm(`Delete ${apartment.name}?`)) return;
    setDeleteBusy(apartment.id);
    try {
      await removeApartment(apartment.id);
    } finally {
      setDeleteBusy("");
    }
  }

  function cardProps(apartment) {
    return {
      apartment,
      filters,
      onSelectionChange: canManage ? (patch) => handleSelectionChange(apartment.id, patch) : undefined,
      selectionBusy: selectionBusy === apartment.id,
      onScrape: canManage ? handleScrape : undefined,
      scrapeBusy: scrapeBusy === apartment.id,
      onAnalyze: canManage && source !== "api" ? handleAnalyze : undefined,
      onDelete: canManage ? handleDelete : undefined,
      analyzeBusy: analyzeBusy === apartment.id,
      deleteBusy: deleteBusy === apartment.id,
    };
  }

  const allListings = useMemo(
    () => apartments.flatMap((apartment) => apartment.listings || []),
    [apartments],
  );

  const filteredListings = useMemo(
    () =>
      sortListings(
        apartments
          .filter((apartment) => apartmentIncludedInListings(apartment, filters))
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

  const favoriteUnits = useMemo(
    () => (!filters.selectionScope ? filteredListings.filter((listing) => listing.isFavorite) : []),
    [filteredListings, filters.selectionScope],
  );

  const watchlistUnits = useMemo(
    () =>
      !filters.selectionScope
        ? filteredListings.filter((listing) => listing.isWatchlisted && !listing.isFavorite)
        : [],
    [filteredListings, filters.selectionScope],
  );

  const unitsMain = useMemo(
    () =>
      filters.selectionScope
        ? filteredListings
        : sortListingsWithCuratedPriority(filteredListings, filters.sort, filters.sortDir),
    [filteredListings, filters.selectionScope, filters.sort, filters.sortDir],
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
      <h1 className="page-title">Dashboard</h1>

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

      {recent.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>Recently changed</h2>
            <p>
              <Link to="/changes">All changes</Link>
            </p>
          </div>
          <div className="changed-rail">
            {recent.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showBuilding
                onSelectionChange={canManage ? (patch) => handleListingSelection(listing.id, patch) : undefined}
                selectionBusy={listingSelectionBusy === listing.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      {favorites.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>★ Favorite buildings</h2>
            <p>{favorites.length} building{favorites.length === 1 ? "" : "s"}</p>
          </div>
          <div className="card-grid">
            {favorites.map((apartment) => (
              <ApartmentCard key={`fav-${apartment.id}`} {...cardProps(apartment)} />
            ))}
          </div>
        </section>
      ) : null}

      {watchlist.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>👁 Building watchlist</h2>
            <p>{watchlist.length} building{watchlist.length === 1 ? "" : "s"}</p>
          </div>
          <div className="card-grid">
            {watchlist.map((apartment) => (
              <ApartmentCard key={`watch-${apartment.id}`} {...cardProps(apartment)} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>{filters.selectionScope ? "Filtered buildings" : "All buildings"}</h2>
          <p>
            {visibleMain.length} building{visibleMain.length === 1 ? "" : "s"}
          </p>
        </div>
        {visibleMain.length === 0 && !loading ? (
          <div className="empty">
            {apartments.length === 0 ? (
              "None"
            ) : (
              <FilterEmptyState
                filters={filters}
                count={apartments.length}
                onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
              />
            )}
          </div>
        ) : (
          <div className="card-grid">
            {visibleMain.map((apartment) => (
              <ApartmentCard key={apartment.id} {...cardProps(apartment)} />
            ))}
          </div>
        )}
      </section>

      {favoriteUnits.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>★ Favorite units</h2>
            <p>{favoriteUnits.length} unit{favoriteUnits.length === 1 ? "" : "s"}</p>
          </div>
          <div className="changed-rail">
            {favoriteUnits.map((listing) => (
              <ListingCard
                key={`fav-unit-${listing.id}`}
                listing={listing}
                showBuilding
                onSelectionChange={canManage ? (patch) => handleListingSelection(listing.id, patch) : undefined}
                selectionBusy={listingSelectionBusy === listing.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      {watchlistUnits.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>👁 Unit watchlist</h2>
            <p>{watchlistUnits.length} unit{watchlistUnits.length === 1 ? "" : "s"}</p>
          </div>
          <div className="changed-rail">
            {watchlistUnits.map((listing) => (
              <ListingCard
                key={`watch-unit-${listing.id}`}
                listing={listing}
                showBuilding
                onSelectionChange={canManage ? (patch) => handleListingSelection(listing.id, patch) : undefined}
                selectionBusy={listingSelectionBusy === listing.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>All units</h2>
          <p>
            {unitsMain.length} unit{unitsMain.length === 1 ? "" : "s"}
          </p>
        </div>
        {unitsMain.length === 0 ? (
          <div className="empty">
            {allListings.length === 0 ? (
              "None"
            ) : (
              <FilterEmptyState
                filters={filters}
                count={allListings.length}
                onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
                noun="units"
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
            onSelectionChange={canManage ? handleListingSelection : undefined}
            selectionBusyId={listingSelectionBusy}
          />
        )}
      </section>

      {adding ? (
        <AddApartmentModal onClose={() => setAdding(false)} onAdd={addApartment} />
      ) : null}
    </Shell>
  );
}

function FilterEmptyState({ filters, count, onClearFilters, noun = "buildings" }) {
  if (hasActiveDashboardFilters(filters)) {
    return (
      <div className="empty-filtered">
        <p>
          No matches — {count} {noun} hidden by your filters.
        </p>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="empty-filtered">
      <p>No matches. Try enabling “Show hidden buildings & units”.</p>
    </div>
  );
}
