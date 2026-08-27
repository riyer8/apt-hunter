import { useCallback, useState } from "react";
import { loadFilters, saveFilters } from "../lib/persist.js";

export function usePersistentFilters() {
  const [filters, setFilters] = useState(loadFilters);

  const update = useCallback((next) => {
    setFilters((current) => {
      const value = typeof next === "function" ? next(current) : next;
      saveFilters(value);
      return value;
    });
  }, []);

  return [filters, update];
}

export function cycleSort(filters, key) {
  const defaultDir = key === "newest" || key === "changed" ? "desc" : "asc";
  const currentDir = filters.sort === key ? filters.sortDir || defaultDir : null;
  if (!currentDir) return { ...filters, sort: key, sortDir: defaultDir };
  return { ...filters, sort: key, sortDir: currentDir === "asc" ? "desc" : "asc" };
}
