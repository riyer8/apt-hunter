export default function SelectionActions({ item, onChange, disabled = false, compact = false }) {
  if (!item) return null;

  const favorite = item.isFavorite === true;
  const watchlisted = item.isWatchlisted === true;
  const discarded = item.isDiscarded === true;

  return (
    <div className={`selection-actions${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={`selection-btn${favorite ? " active favorite" : ""}`}
        disabled={disabled}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorite}
        onClick={() => onChange({ favorite: !favorite })}
      >
        {favorite ? "★" : "☆"} Favorite
      </button>
      <button
        type="button"
        className={`selection-btn${watchlisted ? " active watchlist" : ""}`}
        disabled={disabled}
        title={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={watchlisted}
        onClick={() => onChange({ watchlisted: !watchlisted })}
      >
        {watchlisted ? "👁" : "○"} Watchlist
      </button>
      <button
        type="button"
        className={`selection-btn${discarded ? " active discarded" : ""}`}
        disabled={disabled}
        title={discarded ? "Show again" : "Hide from dashboard"}
        aria-pressed={discarded}
        onClick={() => onChange({ discarded: !discarded })}
      >
        {discarded ? "↩" : "✕"} {discarded ? "Restore" : "Hide"}
      </button>
    </div>
  );
}

export function SelectionBadges({ item }) {
  if (!item) return null;
  const chips = [];
  if (item.isFavorite) chips.push({ key: "favorite", label: "★ Favorite" });
  if (item.isWatchlisted) chips.push({ key: "watchlist", label: "👁 Watchlist" });
  if (item.isDiscarded) chips.push({ key: "discarded", label: "Hidden" });
  if (!chips.length) return null;
  return (
    <div className="selection-badges">
      {chips.map((chip) => (
        <span key={chip.key} className={`selection-badge ${chip.key}`}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
