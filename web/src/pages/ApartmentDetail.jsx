import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { listingMatchesFilters, sortListingsWithCuratedPriority } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import { apartmentChangeSummary } from "../lib/changes.js";
import { monitorMeta } from "../lib/status.js";
import { EMPTY_FILTERS } from "../lib/filters.js";
import { listScrapeHistory } from "../api/apartments.js";
import Shell from "../components/layout/Shell.jsx";
import FilterBar from "../components/listings/FilterBar.jsx";
import ListingsTable from "../components/listings/ListingsTable.jsx";
import AlertPrefsForm from "../components/apartments/AlertPrefsForm.jsx";
import BuildingProfilePanel from "../components/building/BuildingProfilePanel.jsx";
import ApartmentSelectionActions, { SelectionBadges } from "../components/apartments/ApartmentSelectionActions.jsx";
import EditApartmentModal from "../components/apartments/EditApartmentModal.jsx";
import ScrapeProgressBanner from "../components/common/ScrapeProgressBanner.jsx";
import ChangeSummaryStrip from "../components/common/ChangeSummaryStrip.jsx";
import MonitorMetadata from "../components/apartments/MonitorMetadata.jsx";

export default function ApartmentDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const focusUnit = searchParams.get("unit");
  const navigate = useNavigate();
  const {
    apartments,
    loading,
    source,
    removeApartment,
    setMonitorState,
    scrapeNow,
    reanalyzeBuilding,
    updateApartment,
    setApartmentSelection,
    setListingSelection,
    analyzeApartment,
    isScraping,
  } = useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState("");
  const [listingSelectionBusy, setListingSelectionBusy] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canManage = source === "api" || source === "extension";
  const apartment = apartments.find((item) => item.id === id);
  const scraping = apartment ? isScraping(apartment.id) || apartment.scrapeInProgress : false;
  const monitor = apartment ? monitorMeta(apartment, { scraping }) : null;
  const summary = apartment ? apartmentChangeSummary(apartment) : null;

  const listings = useMemo(() => {
    if (!apartment) return [];
    const all = apartment.listings || [];
    let filtered = all.filter((listing) => listingMatchesFilters(listing, filters));
    if (focusUnit) {
      const focused = all.find((listing) => String(listing.unit || "") === focusUnit);
      if (focused && !filtered.some((listing) => listing.id === focused.id)) {
        filtered = [focused, ...filtered];
      }
    }
    return sortListingsWithCuratedPriority(filtered, filters.sort, filters.sortDir);
  }, [apartment, filters, focusUnit]);

  const focusHiddenByFilters = useMemo(() => {
    if (!apartment || !focusUnit) return false;
    const focused = (apartment.listings || []).find((listing) => String(listing.unit || "") === focusUnit);
    return Boolean(focused && !listingMatchesFilters(focused, filters));
  }, [apartment, filters, focusUnit]);

  useEffect(() => {
    if (!id || source !== "api") return undefined;
    let cancelled = false;
    listScrapeHistory(id).then((rows) => {
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [id, source, apartment?.lastChecked, apartment?.scrapeInProgress]);

  if (!loading && !apartment) {
    return (
      <Shell source={source}>
        <div className="empty">
          That building isn’t on your list. <Link to="/">Dashboard</Link>
        </div>
      </Shell>
    );
  }

  async function run(label, action) {
    setError("");
    setBusy(label);
    try {
      await action();
    } catch (err) {
      setError(err.message || "That didn’t work.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Shell source={source}>
      <Link className="back" to="/">
        ← Dashboard
      </Link>

      {apartment ? (
        <>
          {scraping ? <ScrapeProgressBanner label={`Scraping ${apartment.name}…`} /> : null}

          <div className="panel detail-overview">
            <div className="detail-hero">
              <div className="detail-hero-main">
                <h1 className="page-title">{apartment.name}</h1>
                {apartment.location ? <p className="detail-location">{apartment.location}</p> : null}
                <div className="detail-hero-meta">
                  <p className={`status ${monitor.tone}${scraping ? " scraping-pulse" : ""}`}>
                    <span className="dot">{monitor.icon}</span>
                    {monitor.label}
                  </p>
                  {canManage ? (
                    <ApartmentSelectionActions
                      variant="segment"
                      apartment={apartment}
                      disabled={Boolean(busy)}
                      onChange={(patch) => run("selection", () => setApartmentSelection(apartment.id, patch))}
                    />
                  ) : (
                    <SelectionBadges apartment={apartment} />
                  )}
                </div>
              </div>
              <div className="monitor-actions">
                {source === "api" || source === "extension" ? (
                  <>
                    <button
                      type="button"
                      className={`btn btn-primary btn-small${scraping ? " btn-busy" : ""}`}
                      disabled={Boolean(busy) || scraping}
                      onClick={() =>
                        run("scrape", () => (source === "api" ? scrapeNow(apartment.id) : analyzeApartment(apartment)))
                      }
                    >
                      {scraping ? "…" : "Refresh"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={Boolean(busy) || apartment.monitorState === "active"}
                      onClick={() => run("start", () => setMonitorState(apartment.id, "active"))}
                    >
                      Monitor
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={Boolean(busy) || apartment.monitorState === "paused"}
                      onClick={() => run("pause", () => setMonitorState(apartment.id, "paused"))}
                    >
                      Pause
                    </button>
                  </>
                ) : null}
                <a className="btn btn-ghost btn-small" href={apartment.url} target="_blank" rel="noreferrer">
                  Site
                </a>
                {source === "api" ? (
                  <button type="button" className="btn btn-ghost btn-small" disabled={Boolean(busy)} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-small danger-text"
                  onClick={async () => {
                    await removeApartment(apartment.id);
                    navigate("/");
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            <ChangeSummaryStrip summary={summary} />
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}
          {apartment.lastError && apartment.consecutiveFailures > 0 ? (
            <p className="form-error">{apartment.lastError}</p>
          ) : null}

          <section className="page-section page-primary units-section">
            <div className="section-head">
              <h2>Units</h2>
              <p>
                {listings.length} shown
                {apartment.listings.length !== listings.length ? ` · ${apartment.listings.length} total` : ""}
              </p>
            </div>
            <FilterBar filters={filters} onChange={setFilters} showSort />

            {focusHiddenByFilters ? (
              <p className="filter-notice">
                Unit {focusUnit} filtered out.{" "}
                <button type="button" className="text-link" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
                  Clear
                </button>
              </p>
            ) : null}

            {listings.length === 0 ? (
              <div className="empty">
                {apartment.listings.length === 0 ? (
                  "No units yet"
                ) : (
                  <div className="empty-filtered">
                    <p>{apartment.listings.length} units filtered out.</p>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
                      Clear
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <ListingsTable
                listings={listings}
                sortKey={filters.sort}
                sortDir={filters.sortDir}
                highlightUnit={focusUnit}
                onSort={(key) => setFilters(cycleSort(filters, key))}
                onSelectionChange={
                  canManage
                    ? async (listingId, patch) => {
                        setListingSelectionBusy(listingId);
                        try {
                          await setListingSelection(listingId, patch);
                        } catch (err) {
                          setError(err.message || "That didn’t work.");
                        } finally {
                          setListingSelectionBusy("");
                        }
                      }
                    : undefined
                }
                selectionBusyId={listingSelectionBusy}
              />
            )}
          </section>

          <div className="detail-secondary">
            <BuildingProfilePanel
              apartment={apartment}
              source={source}
              busy={busy === "reanalyze"}
              onReanalyze={() => run("reanalyze", () => reanalyzeBuilding(apartment.id))}
            />
            {source === "api" ? <AlertPrefsForm apartmentId={apartment.id} initial={apartment.alertPreferences} /> : null}
            <MonitorMetadata apartment={apartment} history={history} />
          </div>
        </>
      ) : (
        <p className="page-loading">Loading…</p>
      )}

      {editing && apartment ? (
        <EditApartmentModal
          apartment={apartment}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            const result = await updateApartment(apartment.id, patch);
            setNotice(
              result?.refreshed?.availabilities
                ? "Saved. Refreshing listings."
                : result?.refreshed?.profile
                  ? "Saved. Refreshing scores."
                  : "Saved.",
            );
          }}
        />
      ) : null}
    </Shell>
  );
}
