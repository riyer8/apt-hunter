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

  if (message.type === "SAVE_UI") {
    chrome.storage.local.get("aptwatchUi", (result) => {
      chrome.storage.local.set({
        aptwatchUi: { ...(result.aptwatchUi || {}), ...(message.patch || {}) },
      });
    });
  }
});

publish();
window.addEventListener("DOMContentLoaded", publish);
window.addEventListener("load", publish);
