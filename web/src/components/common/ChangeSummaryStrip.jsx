import { apartmentChangeSummary } from "../../lib/changes.js";

const CHANGE_ITEMS = [
  { key: "new", label: "new", field: "new" },
  { key: "drops", label: "drops", field: "priceDrops" },
  { key: "avail", label: "availability", field: "availabilityChanged" },
  { key: "gone", label: "removed", field: "removed" },
];

export function changeSummaryItems(summary) {
  if (!summary) return [];
  return CHANGE_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    value: summary[item.field] ?? 0,
  }));
}

export default function ChangeSummaryStrip({ summary, hideWhenEmpty = true }) {
  const items = changeSummaryItems(summary);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (hideWhenEmpty && total === 0) return null;
  if (!items.length) return null;

  return (
    <div className="activity-strip">
      <span className="activity-strip-label">Activity</span>
      <div className="activity-chips">
        {items.map((item) => (
          <span key={item.key} className={`activity-chip${item.value > 0 ? " has-value" : ""}`}>
            <strong>{item.value}</strong>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function changeSummaryFromApartment(apartment) {
  return apartment ? apartmentChangeSummary(apartment) : null;
}
