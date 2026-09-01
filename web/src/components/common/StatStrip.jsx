export default function StatStrip({
  title,
  items = [],
  hideWhenEmpty = false,
  highlightNonZero = true,
  className = "",
}) {
  const normalized = items.map((item) => {
    const value = item.value ?? "—";
    const numeric = typeof item.value === "number" ? item.value : null;
    const highlight =
      item.highlight ?? (highlightNonZero && numeric != null && numeric > 0 && item.key !== "checked");
    const muted = item.muted ?? (numeric === 0);
    return { ...item, value, highlight, muted };
  });

  const numericTotal = normalized.reduce(
    (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
    0,
  );
  if (hideWhenEmpty && numericTotal === 0) return null;
  if (!normalized.length) return null;

  return (
    <div className={["stat-strip-wrap", className].filter(Boolean).join(" ")}>
      {title ? <div className="stat-strip-title">{title}</div> : null}
      <div className="stat-strip" role="list">
        {normalized.map((item) => (
          <div
            key={item.key}
            className={[
              "stat-strip-item",
              item.muted ? "is-zero" : "",
              item.highlight ? "is-highlight" : "",
              item.small ? "is-small" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="listitem"
          >
            <div className="stat-strip-value">{item.value}</div>
            <div className="stat-strip-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
