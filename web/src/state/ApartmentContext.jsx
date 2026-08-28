import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { matchListingAgainstProfiles, mergeFeatures, normalizePreferenceBundle } from "@shared/match.js";
import * as api from "../api/apartments.js";

const ApartmentContext = createContext(null);

export function ApartmentProvider({ children }) {
  const [apartments, setApartments] = useState([]);
  const [preferences, setPreferences] = useState(normalizePreferenceBundle());
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("local");

  const refresh = useCallback(async () => {
    const [items, prefs] = await Promise.all([api.listApartments(), api.getUserPreferences()]);
    setApartments(items);
    setPreferences(normalizePreferenceBundle(prefs));
    setSource(api.getDataSource());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("aptwatch:apartments-changed", onChange);
    window.addEventListener("storage", onChange);
    const poll = setInterval(onChange, 45000);
    let listener;
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      listener = (changes, area) => {
        if (area === "local" && (changes.apartments || changes.listingLedger)) onChange();
      };
      chrome.storage.onChanged.addListener(listener);
    }
    return () => {
      window.removeEventListener("aptwatch:apartments-changed", onChange);
      window.removeEventListener("storage", onChange);
      clearInterval(poll);
      if (listener) chrome.storage.onChanged.removeListener(listener);
    };
  }, [refresh]);

  const addApartment = useCallback(
    async (input) => {
      const created = await api.addApartment(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  const removeApartment = useCallback(
    async (id) => {
      await api.removeApartment(id);
      await refresh();
    },
    [refresh],
  );

  const setMonitorState = useCallback(
    async (id, state) => {
      await api.setMonitorState(id, state);
      await refresh();
    },
    [refresh],
  );

  const scrapeNow = useCallback(
    async (id) => {
      const result = await api.scrapeNow(id);
      await refresh();
      return result;
    },
    [refresh],
  );

  const reanalyzeBuilding = useCallback(
    async (id) => {
      const result = await api.reanalyzeBuilding(id);
      await refresh();
      return result;
    },
    [refresh],
  );

  const savePreferences = useCallback((prefs) => {
    setPreferences(normalizePreferenceBundle(prefs));
  }, []);

  const scoredApartments = useMemo(() => attachMatches(apartments, preferences), [apartments, preferences]);

  const value = useMemo(
    () => ({
      apartments: scoredApartments,
      preferences,
      loading,
      source,
      refresh,
      addApartment,
      removeApartment,
      setMonitorState,
      scrapeNow,
      reanalyzeBuilding,
      savePreferences,
    }),
    [scoredApartments, preferences, loading, source, refresh, addApartment, removeApartment, setMonitorState, scrapeNow, reanalyzeBuilding, savePreferences],
  );

  return <ApartmentContext.Provider value={value}>{children}</ApartmentContext.Provider>;
}

export function useApartments() {
  const value = useContext(ApartmentContext);
  if (!value) throw new Error("useApartments must be used within ApartmentProvider");
  return value;
}

function attachMatches(apartments, prefs) {
  return (apartments || []).map((apartment) => ({
    ...apartment,
    listings: (apartment.listings || []).map((listing) => {
      const features = mergeFeatures(apartment.features, listing.features);
      const location = listing.location || apartment.location;
      return {
        ...listing,
        apartmentId: listing.apartmentId || apartment.id,
        apartmentName: listing.apartmentName || apartment.name,
        features,
        location,
        buildingProfile: listing.buildingProfile || apartment.buildingProfile || null,
        match: matchListingAgainstProfiles({ ...listing, features, location }, prefs?.profiles || []),
      };
    }),
  }));
}
