export const CHANGE_EVENT_TYPES = [
  "NEW",
  "PRICE_DROP",
  "PRICE_INCREASE",
  "AVAILABILITY_CHANGED",
  "REMOVED",
];

export const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function parseIsoTime(iso) {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

export function filterRecentChanges(changes, now = Date.now()) {
  const cutoff = now - CHANGE_WINDOW_MS;
  return (changes || []).filter((change) => {
    const at = parseIsoTime(change.detectedAt);
    return at != null && at >= cutoff;
  });
}

export function countChangesByType(changes) {
  const tally = Object.fromEntries(CHANGE_EVENT_TYPES.map((key) => [key, 0]));
  for (const change of changes) {
    if (tally[change.changeType] != null) tally[change.changeType] += 1;
  }
  return tally;
}
