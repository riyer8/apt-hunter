import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listingMatchesFilters, sortListingsWithCuratedPriority } from "@shared/listingView.js";
import { useApartments } from "../state/ApartmentContext.jsx";
import { cycleSort, usePersistentFilters } from "../hooks/usePersistentFilters.js";
import { apartmentChangeSummary } from "../lib/changes.js";
import { formatClock, formatDateTime, formatRelativeTime } from "../lib/format.js";
import { monitorMeta } from "../lib/status.js";
import { listScrapeHistory } from "../api/apartments.js";
import Shell from "../components/Shell.jsx";
import FilterBar from "../components/FilterBar.jsx";
import ListingsTable from "../components/ListingsTable.jsx";
import AlertPrefsForm from "../components/AlertPrefsForm.jsx";
import BuildingProfilePanel from "../components/BuildingProfilePanel.jsx";
import ApartmentSelectionActions, { SelectionBadges } from "../components/ApartmentSelectionActions.jsx";

export default function ApartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apartments, loading, source, removeApartment, setMonitorState, scrapeNow, reanalyzeBuilding, setApartmentSelection, setListingSelection, analyzeApartment } =
    useApartments();
  const [filters, setFilters] = usePersistentFilters();
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState("");
  const [listingSelectionBusy, setListingSelectionBusy] = useState("");
  const [error, setError] = useState("");
  const canManage = source === "api" || source === "extension";
  const apartment = apartments.find((item) => item.id === id);
  const monitor = apartment ? monitorMeta(apartment) : null;
  const summary = apartment ? apartmentChangeSummary(apartment) : null;

  const listings = useMemo(() => {
    if (!apartment) return [];
    const filtered = (apartment.listings || []).filter((listing) => listingMatchesFilters(listing, filters));
    return sortListingsWithCuratedPriority(filtered, filters.sort, filters.sortDir);
  }, [apartment, filters]);

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
        ← All apartments
      </Link>

      {apartment ? (
        <>
          <div className="detail-hero">
            <div>
              <h1 className="page-title">{apartment.name}</h1>
              {apartment.location ? <p className="lede">{apartment.location}</p> : null}
              <SelectionBadges apartment={apartment} />
              <p className={`status ${monitor.tone}`}>
                <span className="dot">{monitor.icon}</span>
                {monitor.label}
              </p>
              <p className="lede" style={{ marginBottom: 0 }}>
                Last successful scrape: {formatDateTime(apartment.lastSuccessfulScrape)}
                <br />
                Last attempt: {formatDateTime(apartment.lastAttemptAt || apartment.lastChecked)}
              </p>
            </div>
            <div className="monitor-actions">
              {source === "api" || source === "extension" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run("scrape", () => (source === "api" ? scrapeNow(apartment.id) : analyzeApartment(apartment)))
                    }
                  >
                    {busy === "scrape" || busy === "analyze" ? "Refreshing…" : "Refresh listings"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={Boolean(busy) || apartment.monitorState === "active"}
                    onClick={() => run("start", () => setMonitorState(apartment.id, "active"))}
                  >
                    Start monitoring
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={Boolean(busy) || apartment.monitorState === "paused"}
                    onClick={() => run("pause", () => setMonitorState(apartment.id, "paused"))}
                  >
                    Pause monitoring
                  </button>
                </>
              ) : null}
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

          <ApartmentSelectionActions
            apartment={apartment}
            disabled={Boolean(busy)}
            onChange={(patch) => run("selection", () => setApartmentSelection(apartment.id, patch))}
          />

          {error ? <p className="error">{error}</p> : null}
          {apartment.lastError && apartment.consecutiveFailures > 0 ? (
            <p className="error">{apartment.lastError}</p>
          ) : null}

          <BuildingProfilePanel
            apartment={apartment}
            source={source}
            busy={busy === "reanalyze"}
            onReanalyze={() => run("reanalyze", () => reanalyzeBuilding(apartment.id))}
          />

          {summary ? (
            <dl className="change-stats" style={{ marginBottom: 24 }}>
              <div>
                <dt>New listings</dt>
                <dd>{summary.new}</dd>
              </div>
              <div>
                <dt>Price drops</dt>
                <dd>{summary.priceDrops}</dd>
              </div>
              <div>
                <dt>Availability changes</dt>
                <dd>{summary.availabilityChanged}</dd>
              </div>
              <div>
                <dt>Recently removed</dt>
                <dd>{summary.removed}</dd>
              </div>
            </dl>
          ) : null}

          {history.length > 0 ? (
            <section className="scrape-history">
              <div className="section-head">
                <h2>Scrape history</h2>
              </div>
              <ol className="history-list">
                {history.map((run) => (
                  <li key={run.id}>
                    <span className="history-time">{formatClock(run.completedAt || run.startedAt)}</span>
                    <span>{run.status === "failed" ? "✕" : "✓"}</span>
                    <span>
                      {run.status === "failed"
                        ? run.errorMessage || "failed"
                        : `${run.listingsFound} listing${run.listingsFound === 1 ? "" : "s"}`}
                    </span>
                    <span className="history-when">{formatRelativeTime(run.completedAt || run.startedAt)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {source === "api" ? <AlertPrefsForm apartmentId={apartment.id} initial={apartment.alertPreferences} /> : null}

          <FilterBar filters={filters} onChange={setFilters} showSort />

          {listings.length === 0 ? (
            <div className="empty">
              {apartment.listings.length === 0 ? "None" : "No matches"}
            </div>
          ) : (
            <ListingsTable
              listings={listings}
              sortKey={filters.sort}
              sortDir={filters.sortDir}
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
        </>
      ) : (
        <p className="lede">Loading…</p>
      )}
    </Shell>
  );
}
