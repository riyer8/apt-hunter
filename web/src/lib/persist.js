import { persistUiPrefs } from "../api/apartments.js";
import { EMPTY_FILTERS } from "./filters.js";

const FILTERS_KEY = "aptwatch.web.filters";

export function loadFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    return raw ? { ...EMPTY_FILTERS, ...JSON.parse(raw) } : { ...EMPTY_FILTERS };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

export function saveFilters(filters) {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  persistUiPrefs({ webFilters: filters });
}
