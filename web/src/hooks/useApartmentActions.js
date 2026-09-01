import { useState } from "react";
import { useApartments } from "../state/ApartmentContext.jsx";

export function useApartmentActions() {
  const {
    source,
    removeApartment,
    setApartmentSelection,
    setListingSelection,
    scrapeNow,
    analyzeApartment,
  } = useApartments();
  const [selectionBusy, setSelectionBusy] = useState("");
  const [listingSelectionBusy, setListingSelectionBusy] = useState("");
  const [deleteBusy, setDeleteBusy] = useState("");
  const canManage = source === "api" || source === "extension";

  async function handleListingSelection(id, patch) {
    setListingSelectionBusy(id);
    try {
      await setListingSelection(id, patch);
    } catch (error) {
      window.alert(error?.message || "Could not update that unit.");
    } finally {
      setListingSelectionBusy("");
    }
  }

  async function handleSelectionChange(id, patch) {
    setSelectionBusy(id);
    try {
      await setApartmentSelection(id, patch);
    } catch (error) {
      window.alert(error?.message || "Could not update that building.");
    } finally {
      setSelectionBusy("");
    }
  }

  async function handleScrape(apartment) {
    try {
      if (source === "api") {
        await scrapeNow(apartment.id);
      } else {
        await analyzeApartment(apartment);
      }
    } catch (error) {
      window.alert(error?.message || "Refresh failed.");
    }
  }

  async function handleAnalyze(apartment) {
    try {
      await analyzeApartment(apartment);
    } catch (error) {
      window.alert(error?.message || "Analyze failed.");
    }
  }

  async function handleDelete(apartment) {
    if (!window.confirm(`Delete ${apartment.name}?`)) return;
    setDeleteBusy(apartment.id);
    try {
      await removeApartment(apartment.id);
    } finally {
      setDeleteBusy("");
    }
  }

  function cardProps(apartment, filters) {
    return {
      apartment,
      filters,
      onSelectionChange: canManage ? (patch) => handleSelectionChange(apartment.id, patch) : undefined,
      selectionBusy: selectionBusy === apartment.id,
      onScrape: canManage ? handleScrape : undefined,
      onAnalyze: canManage && source !== "api" ? handleAnalyze : undefined,
      onDelete: canManage ? handleDelete : undefined,
      deleteBusy: deleteBusy === apartment.id,
    };
  }

  return {
    source,
    canManage,
    listingSelectionBusy,
    handleListingSelection: canManage ? handleListingSelection : undefined,
    cardProps,
  };
}
