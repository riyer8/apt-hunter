import { apiAvailable, apiRequest, getApiUrl } from "../lib/backend.js";

const ALARM = "aptwatch-alerts";
const CLICKS_KEY = "notificationClicks";

export function startAlertPolling() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  pullAlerts().catch(() => {});
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) pullAlerts().catch(() => {});
});

chrome.notifications.onClicked.addListener(async (id) => {
  const stored = await chrome.storage.local.get(CLICKS_KEY);
  const urls = stored[CLICKS_KEY] || {};
  const url = urls[id];
  if (url) {
    chrome.tabs.create({ url });
    delete urls[id];
    await chrome.storage.local.set({ [CLICKS_KEY]: urls });
  }
  chrome.notifications.clear(id);
});

async function pullAlerts() {
  if (!(await apiAvailable())) return;
  const data = await apiRequest("/notifications?pending=1&limit=20");
  const clicks = (await chrome.storage.local.get(CLICKS_KEY))[CLICKS_KEY] || {};

  for (const item of data.notifications || []) {
    const claimed = await apiRequest(`/notifications/${item.id}/deliver`, { method: "POST" });
    if (!claimed?.claimed) continue;
    const clickUrl = item.clickUrl || item.listingUrl || `${getApiUrl().replace(":8787", ":5173")}/apartments/${item.apartmentId}`;
    clicks[item.id] = clickUrl;
    chrome.notifications.create(item.id, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: item.title,
      message: item.body,
      priority: 1,
    });
  }

  await chrome.storage.local.set({ [CLICKS_KEY]: clicks });
}
