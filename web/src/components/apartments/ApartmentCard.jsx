import { Link } from "react-router-dom";
import { apartmentChangeSummary } from "../../lib/changes.js";
import { matchingListings } from "../../lib/filters.js";
import { changeCount, monitorMeta } from "../../lib/status.js";
import { useApartments } from "../../state/ApartmentContext.jsx";
import { OverallScore } from "../building/BuildingScores.jsx";
import ApartmentSelectionActions, { SelectionBadges } from "./ApartmentSelectionActions.jsx";
import ScrapeProgressBanner from "../common/ScrapeProgressBanner.jsx";

export default function ApartmentCard({
  apartment,
  filters,
  onSelectionChange,
  selectionBusy = false,
  onAnalyze,
  onScrape,
  onDelete,
  deleteBusy = false,
  showActions = true,
}) {
  const { isScraping } = useApartments();
  const listings = matchingListings(apartment, filters);
  const totalListings = (apartment.listings || []).length;
  const summary = apartmentChangeSummary(apartment);
  const scraping = isScraping(apartment.id) || apartment.scrapeInProgress;
  const monitor = monitorMeta(apartment, { scraping });
  const changes = changeCount({ changeSummary: summary });

  return (
    <article className={`apt-card${scraping ? " scraping" : ""}`}>
      {scraping ? <ScrapeProgressBanner label={`Scraping ${apartment.name}…`} /> : null}
      <div className="apt-card-top">
        <div>
          <h2 className="apt-name">
            <Link to={`/apartments/${apartment.id}`}>{apartment.name}</Link>
          </h2>
          {apartment.location ? <p className="apt-location">{apartment.location}</p> : null}
          <SelectionBadges item={apartment} />
        </div>
        <span className={`status ${monitor.tone}${scraping ? " scraping-pulse" : ""}`}>
          <span className="dot">{monitor.icon}</span>
          {monitor.label}
        </span>
      </div>

      <div className="apt-meta">
        <span>
          {totalListings} unit{totalListings === 1 ? "" : "s"}
          {listings.length !== totalListings ? ` · ${listings.length} match` : ""}
          {changes ? ` · ${changes} new` : ""}
        </span>
        {apartment.buildingProfile ? (
          <span>
            Score <OverallScore profile={apartment.buildingProfile} />
          </span>
        ) : null}
      </div>

      {onSelectionChange ? (
        <ApartmentSelectionActions
          apartment={apartment}
          onChange={onSelectionChange}
          disabled={selectionBusy || scraping}
          compact
        />
      ) : null}

      {showActions ? (
        <div className="apt-card-actions">
          {onScrape ? (
            <button
              type="button"
              className={`btn btn-primary btn-small${scraping ? " btn-busy" : ""}`}
              disabled={scraping || deleteBusy}
              onClick={() => onScrape(apartment)}
            >
              {scraping ? "…" : "Refresh"}
            </button>
          ) : onAnalyze ? (
            <button
              type="button"
              className={`btn btn-primary btn-small${scraping ? " btn-busy" : ""}`}
              disabled={scraping || deleteBusy}
              onClick={() => onAnalyze(apartment)}
            >
              {scraping ? "…" : "Refresh"}
            </button>
          ) : null}
          <Link className="btn btn-ghost btn-small" to={`/apartments/${apartment.id}`}>
            Units
          </Link>
          <a className="btn btn-ghost btn-small" href={apartment.url} target="_blank" rel="noreferrer">
            Site
          </a>
          {onDelete ? (
            <button
              type="button"
              className="btn btn-ghost btn-small danger-text"
              disabled={scraping || deleteBusy}
              onClick={() => onDelete(apartment)}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="apt-card-footer">
          <a className="source-link" href={apartment.url} target="_blank" rel="noreferrer">
            Site
          </a>
          <Link className="btn btn-ghost btn-small" to={`/apartments/${apartment.id}`}>
            Units
          </Link>
        </div>
      )}
    </article>
  );
}
