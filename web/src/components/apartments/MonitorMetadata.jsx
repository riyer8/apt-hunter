import { formatDateTime, formatRelativeTime, formatUntil } from "../../lib/format.js";
import { monitorMeta } from "../../lib/status.js";

export default function MonitorMetadata({ apartment, history = [] }) {
  if (!apartment) return null;

  const monitor = monitorMeta(apartment);
  const lastSuccess = apartment.lastSuccessfulScrape;
  const lastAttempt = apartment.lastAttemptAt || apartment.lastChecked;
  const nextCheck = apartment.monitorState === "active" ? formatUntil(apartment.nextScrapeAt) : "Off";

  return (
    <details className="metadata-panel">
      <summary className="metadata-panel-summary">
        <span>Monitor</span>
        <span className="metadata-panel-hint">
          {lastSuccess ? formatRelativeTime(lastSuccess) : "No scrape yet"}
        </span>
      </summary>
      <div className="metadata-panel-body">
        <dl className="metadata-grid">
          <div>
            <dt>Status</dt>
            <dd className={`status ${monitor.tone}`}>{monitor.label}</dd>
          </div>
          <div>
            <dt>Last OK</dt>
            <dd>{lastSuccess ? formatDateTime(lastSuccess) : "—"}</dd>
          </div>
          <div>
            <dt>Last try</dt>
            <dd>{lastAttempt ? formatDateTime(lastAttempt) : "—"}</dd>
          </div>
          <div>
            <dt>Next</dt>
            <dd>{nextCheck}</dd>
          </div>
        </dl>

        {history.length > 0 ? (
          <div className="metadata-history">
            <h3>History</h3>
            <ol className="history-list">
              {history.map((run) => (
                <li key={run.id}>
                  <span className="history-time">{formatDateTime(run.completedAt || run.startedAt)}</span>
                  <span>{run.status === "failed" ? "Fail" : "OK"}</span>
                  <span>
                    {run.status === "failed"
                      ? run.errorMessage || "error"
                      : `${run.listingsFound} unit${run.listingsFound === 1 ? "" : "s"}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}
