const ACTIONS = [
  {
    id: "favorite",
    label: "Pin",
    activeLabel: "Pinned",
    title: "Show at top of dashboard",
    activeTitle: "Unpin",
  },
  {
    id: "watchlist",
    label: "Track",
    activeLabel: "Tracking",
    title: "Highlight changes",
    activeTitle: "Stop tracking",
  },
  {
    id: "discarded",
    label: "Hide",
    activeLabel: "Hidden",
    title: "Remove from dashboard",
    activeTitle: "Show again",
  },
];

export default function SelectionActions({ item, onChange, disabled = false, compact = false, variant = "buttons" }) {
  if (!item) return null;

  const favorite = item.isFavorite === true;
  const watchlisted = item.isWatchlisted === true;
  const discarded = item.isDiscarded === true;
  const state = { favorite, watchlist: watchlisted, discarded };

  const className = ["selection-actions", compact ? "compact" : "", variant === "segment" ? "segment" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {ACTIONS.map((action) => {
        const active = state[action.id];
        const patchKey = action.id === "watchlist" ? "watchlisted" : action.id;
        return (
          <button
            key={action.id}
            type="button"
            className={`selection-btn${active ? ` active ${action.id}` : ""}`}
            disabled={disabled}
            title={active ? action.activeTitle : action.title}
            aria-pressed={active}
            onClick={() => onChange({ [patchKey]: !active })}
          >
            {active ? action.activeLabel : action.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectionBadges({ item }) {
  if (!item) return null;
  const chips = ACTIONS.filter((action) => {
    if (action.id === "favorite") return item.isFavorite;
    if (action.id === "watchlist") return item.isWatchlisted;
    if (action.id === "discarded") return item.isDiscarded;
    return false;
  }).map((action) => ({
    key: action.id,
    label: action.activeLabel,
  }));
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
