import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  browserPermissionDecision,
  chromeNotificationOptions,
  decideNotification,
  notificationClickUrl,
} from "./notify.js";

const listing = {
  id: "lst-1204",
  apartmentId: "apt-george",
  apartmentName: "The George",
  unit: "1204",
  price: 3995,
  bedrooms: 1,
  sqft: 620,
  availableDate: "2026-09-20",
  listingUrl: "https://example.com/george/1204",
};

const prefs = {
  newListings: true,
  priceDrops: true,
  priceIncreases: false,
  availabilityChanges: true,
};

describe("decideNotification", () => {
  it("1. a NEW listing creates a Chrome notification", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-1", type: "NEW" },
      listing,
      prefs,
    });
    assert.equal(result.notify, true);
    assert.equal(result.notification.notificationType, "NEW_LISTING");
    const chrome = chromeNotificationOptions(result.notification);
    assert.match(chrome.title, /NEW APARTMENT/);
    assert.match(chrome.message, /The George — Unit 1204/);
    assert.match(chrome.message, /\$3,995\/mo/);
    assert.match(chrome.message, /1 bed · 620 sqft/);
    assert.match(chrome.message, /Available Sep 20/);
  });

  it("match-based alerts change NEW listing copy only when enabled", () => {
    const match = { qualifies: true, score: 94 };
    const off = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-match-off", type: "NEW" },
      listing,
      prefs,
      userPrefs: { matchAlerts: false },
      match,
    });
    assert.match(off.notification.title, /NEW APARTMENT/);
    const on = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-match-on", type: "NEW" },
      listing,
      prefs,
      userPrefs: { matchAlerts: true },
      match,
    });
    assert.equal(on.notification.title, "🆕 NEW 94% MATCH");
    assert.match(on.notification.body, /\$3,995 · 620 sqft/);
  });

  it("2. a PRICE_DROP creates a Chrome notification", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-2", type: "PRICE_DROP" },
      listing: { ...listing, price: 3800 },
      prefs,
    });
    assert.equal(result.notify, true);
    assert.equal(result.notification.notificationType, "PRICE_DROP");
    assert.match(result.notification.title, /PRICE DROP/);
  });

  it("3. a PRICE_INCREASE notifies only when enabled", () => {
    const change = { id: "chg-3", type: "PRICE_INCREASE" };
    const off = decideNotification({ outcome: "SUCCESS", change, listing, prefs });
    assert.equal(off.notify, false);
    assert.equal(off.reason, "pref-disabled");
    const on = decideNotification({
      outcome: "SUCCESS",
      change,
      listing,
      prefs: { ...prefs, priceIncreases: true },
    });
    assert.equal(on.notify, true);
    assert.equal(on.notification.notificationType, "PRICE_INCREASE");
  });

  it("4. an AVAILABILITY_CHANGED event creates a Chrome notification", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-4", type: "AVAILABILITY_CHANGED" },
      listing,
      prefs,
    });
    assert.equal(result.notify, true);
    assert.equal(result.notification.notificationType, "AVAILABILITY_CHANGED");
  });

  it("5. filters skip listings that do not match", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-5", type: "NEW" },
      listing,
      prefs: { ...prefs, maxRent: 3000 },
    });
    assert.equal(result.notify, false);
    assert.equal(result.reason, "filtered");
  });

  it("6. the same change event does not notify twice", () => {
    const change = { id: "chg-6", type: "NEW" };
    const first = decideNotification({ outcome: "SUCCESS", change, listing, prefs });
    const second = decideNotification({
      outcome: "SUCCESS",
      change,
      listing,
      prefs,
      alreadyNotifiedChangeIds: new Set(["chg-6"]),
    });
    assert.equal(first.notify, true);
    assert.equal(second.notify, false);
    assert.equal(second.reason, "duplicate");
  });

  it("7. a failed scrape creates no notification", () => {
    const result = decideNotification({
      outcome: "FAILED",
      change: { id: "chg-7", type: "NEW" },
      listing,
      prefs,
    });
    assert.equal(result.notify, false);
    assert.equal(result.reason, "failed-scrape");
  });

  it("8. baseline scrape does not notify", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-baseline", type: "NEW" },
      listing,
      prefs,
      baselineScrape: true,
    });
    assert.equal(result.notify, false);
    assert.equal(result.reason, "baseline-scrape");
  });

  it("8b. a REMOVED favorite unit creates a notification", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-removed-fav", type: "REMOVED" },
      listing: { ...listing, isFavorite: true },
      prefs,
    });
    assert.equal(result.notify, true);
    assert.equal(result.notification.notificationType, "FAVORITE_REMOVED");
    assert.match(result.notification.title, /FAVORITE NO LONGER AVAILABLE/);
  });

  it("8c. a REMOVED non-favorite unit does not notify", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-removed", type: "REMOVED" },
      listing,
      prefs,
    });
    assert.equal(result.notify, false);
    assert.equal(result.reason, "not-favorite");
  });

  it("9. clicking a notification opens the listing URL", () => {
    const result = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-8", type: "NEW" },
      listing,
      prefs,
    });
    assert.equal(notificationClickUrl(result.notification), listing.listingUrl);
    const noUrl = decideNotification({
      outcome: "SUCCESS",
      change: { id: "chg-8b", type: "NEW", apartmentId: "apt-george" },
      listing: { ...listing, listingUrl: null, apartmentId: "apt-george" },
      prefs,
    });
    assert.equal(notificationClickUrl(noUrl.notification), "http://localhost:5173/apartments/apt-george");
  });

  it("10. marking a notification as read sets read_at", () => {
    const row = { id: "n1", read_at: null };
    const read = markRead(row, "2026-08-27T16:00:00.000Z");
    assert.equal(read.read_at, "2026-08-27T16:00:00.000Z");
    assert.equal(row.read_at, null);
  });

  it("11. denied notification permission is handled without prompting again", () => {
    const denied = browserPermissionDecision("denied", { asked: false });
    assert.equal(denied.showPrompt, false);
    assert.equal(denied.enabled, false);
    assert.match(denied.notice, /Browser notifications are disabled/);
    const asked = browserPermissionDecision("default", { asked: true });
    assert.equal(asked.showPrompt, false);
    assert.match(asked.notice, /Enable notifications/);
    const granted = browserPermissionDecision("granted");
    assert.equal(granted.enabled, true);
    assert.equal(granted.showPrompt, false);
  });
});

function markRead(row, at) {
  return { ...row, read_at: at };
}
