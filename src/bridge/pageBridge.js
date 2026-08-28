const SOURCE_EXT = "aptwatch-extension";
const SOURCE_WEB = "aptwatch-web";

function publish() {
  chrome.storage.local.get(
    ["apartments", "extractedListings", "listingLedger", "aptwatchUi"],
    (data) => {
      window.postMessage({ source: SOURCE_EXT, type: "STATE", payload: data || {} }, "*");
    },
  );
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") publish();
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (!message || message.source !== SOURCE_WEB) return;

  if (message.type === "GET") {
    publish();
    return;
  }

  if (message.type === "ADD") {
    chrome.storage.local.get("apartments", (result) => {
      const apartments = result.apartments || [];
      const normalized = String(message.url || "")
        .trim()
        .replace(/\/+$/, "")
        .toLowerCase();
      const duplicate = apartments.some(
        (item) => String(item.url || "").trim().replace(/\/+$/, "").toLowerCase() === normalized,
      );
      if (duplicate) {
        window.postMessage(
          { source: SOURCE_EXT, type: "ERROR", error: "This URL is already being monitored." },
          "*",
        );
        return;
      }
      apartments.push({
        id: crypto.randomUUID(),
        name: String(message.name || "").trim(),
        url: String(message.url || "").trim(),
        dateAdded: new Date().toISOString(),
        status: "Not analyzed",
        listings: [],
      });
      chrome.storage.local.set({ apartments });
    });
    return;
  }

  if (message.type === "REMOVE") {
    chrome.storage.local.get(["apartments", "extractedListings"], (result) => {
      const apartments = (result.apartments || []).filter((item) => item.id !== message.id);
      const extracted = { ...(result.extractedListings || {}) };
      delete extracted[message.id];
      chrome.storage.local.set({ apartments, extractedListings: extracted });
    });
    return;
  }

  if (message.type === "ANALYZE") {
    chrome.runtime.sendMessage(
      {
        type: "ANALYZE_APARTMENT",
        id: message.id,
        url: message.url,
      },
      () => publish(),
    );
    return;
  }

  if (message.type === "SYNC_FROM_BACKEND") {
    chrome.runtime.sendMessage({ type: "SYNC_FROM_BACKEND" }, () => publish());
    return;
  }

  if (message.type === "SAVE_UI") {
    chrome.storage.local.get("aptwatchUi", (result) => {
      chrome.storage.local.set({
        aptwatchUi: { ...(result.aptwatchUi || {}), ...(message.patch || {}) },
      });
    });
    return;
  }

  if (message.type === "UPDATE_SELECTION") {
    chrome.storage.local.get(["apartments", "extractedListings"], (result) => {
      const patch = message.patch || {};
      const applyPatch = (item) => {
        const next = { ...item };
        if (patch.favorite !== undefined) next.isFavorite = patch.favorite;
        if (patch.watchlisted !== undefined) next.isWatchlisted = patch.watchlisted;
        if (patch.discarded !== undefined) next.isDiscarded = patch.discarded;
        return next;
      };

      if (message.apartmentId) {
        const apartments = (result.apartments || []).map((item) =>
          item.id === message.apartmentId ? applyPatch(item) : item,
        );
        chrome.storage.local.set({ apartments });
        return;
      }

      if (message.listingId) {
        let changed = false;
        const apartments = (result.apartments || []).map((apartment) => {
          const listings = (apartment.listings || []).map((listing) => {
            if (listing.id !== message.listingId) return listing;
            changed = true;
            return applyPatch(listing);
          });
          return listings === apartment.listings ? apartment : { ...apartment, listings };
        });
        const extracted = { ...(result.extractedListings || {}) };
        for (const [aptId, listings] of Object.entries(extracted)) {
          const nextListings = listings.map((listing) => {
            if (listing.id !== message.listingId) return listing;
            changed = true;
            return applyPatch(listing);
          });
          if (nextListings !== listings) extracted[aptId] = nextListings;
        }
        if (changed) chrome.storage.local.set({ apartments, extractedListings: extracted });
      }
    });
  }
});

publish();
window.addEventListener("DOMContentLoaded", publish);
window.addEventListener("load", publish);
