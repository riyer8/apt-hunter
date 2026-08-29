export default function ScrapeProgressBanner({ label = "Scraping availability page…" }) {
  return (
    <div className="scrape-progress" role="status" aria-live="polite">
      <span className="scrape-progress-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
