import express from "express";
import {
  assembleApartments,
  claimNotificationDelivery,
  createOrGetApartment,
  deleteApartment,
  getAlertPrefs,
  getApartmentRow,
  listApartmentRows,
  listChanges,
  listNotifications,
  listScrapeRuns,
  listingsForApartments,
  markAllNotificationsRead,
  markNotificationRead,
  previousPricesFor,
  recordScrape,
  saveAlertPrefs,
  setMonitorState,
  unreadNotificationCount,
} from "./store.js";
import { toApiListing, toApiScrapeRun } from "./serialize.js";
import { isUuid, parseAlertPrefs, parseApartmentInput, parseMonitorState, parseScrapeInput } from "./validate.js";
import { getMonitor, schedulerStatus } from "./scheduler.js";

export const apartmentsRouter = express.Router();

apartmentsRouter.post("/", async (req, res, next) => {
  try {
    const input = parseApartmentInput(req.body);
    const { apartment, created } = await createOrGetApartment(input);
    const [payload] = await assembleApartments([apartment]);
    res.status(created ? 201 : 200).json(payload);
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listApartmentRows();
    res.json(await assembleApartments(rows));
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/:id", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    const [payload] = await assembleApartments([apartment]);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.delete("/:id", async (req, res, next) => {
  try {
    await loadApartment(req.params.id);
    await deleteApartment(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/:id/listings", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const listings = await listingsForApartments([apartment.id], { includeInactive });
    const previous = await previousPricesFor(listings.map((row) => row.id));
    res.json(
      listings.map((listing) => {
        const previousPrice = previous.get(listing.id);
        return toApiListing(
          listing,
          apartment.name,
          previousPrice != null && previousPrice !== Number(listing.price) ? previousPrice : null,
        );
      }),
    );
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.post("/:id/scrape", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    const payload = parseScrapeInput(req.body);
    const run = await recordScrape(apartment, payload);
    const fresh = await getApartmentRow(apartment.id);
    const [saved] = await assembleApartments([fresh]);
    res.status(201).json({ scrape: toApiScrapeRun(run), apartment: saved });
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.post("/:id/scrape-now", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    const result = await getMonitor().scrapeNow(apartment);
    if (result.skipped) {
      res.status(409).json({ error: "A scrape is already running for this apartment.", result });
      return;
    }
    const fresh = await getApartmentRow(apartment.id);
    const [saved] = await assembleApartments([fresh]);
    res.json({ scrape: result, apartment: saved });
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.post("/:id/monitor", async (req, res, next) => {
  try {
    await loadApartment(req.params.id);
    const state = parseMonitorState(req.body);
    const updated = await setMonitorState(req.params.id, state);
    const [saved] = await assembleApartments([updated]);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/:id/scrape-history", async (req, res, next) => {
  try {
    await loadApartment(req.params.id);
    res.json(await listScrapeRuns(req.params.id));
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/:id/alerts", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    res.json(await getAlertPrefs(apartment.id));
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.put("/:id/alerts", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    res.json(await saveAlertPrefs(apartment.id, parseAlertPrefs(req.body)));
  } catch (error) {
    next(error);
  }
});

apartmentsRouter.get("/:id/changes", async (req, res, next) => {
  try {
    const apartment = await loadApartment(req.params.id);
    res.json(await listChanges({ apartmentId: apartment.id, type: req.query.type, limit: req.query.limit }));
  } catch (error) {
    next(error);
  }
});

export const notificationsRouter = express.Router();

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
    const pendingDelivery = req.query.pending === "1" || req.query.pending === "true";
    const [items, unread] = await Promise.all([
      listNotifications({ unreadOnly, pendingDelivery, limit: req.query.limit }),
      unreadNotificationCount(),
    ]);
    res.json({ notifications: items, unreadCount: unread });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/read-all", async (_req, res, next) => {
  try {
    await markAllNotificationsRead();
    res.json({ ok: true, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      const error = new Error("That notification id is not valid.");
      error.status = 400;
      throw error;
    }
    const row = await markNotificationRead(req.params.id);
    if (!row) {
      const error = new Error("Notification not found.");
      error.status = 404;
      throw error;
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/:id/deliver", async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      const error = new Error("That notification id is not valid.");
      error.status = 400;
      throw error;
    }
    const row = await claimNotificationDelivery(req.params.id);
    res.json({ claimed: Boolean(row), notification: row });
  } catch (error) {
    next(error);
  }
});

export async function listChangesHandler(req, res, next) {
  try {
    const apartmentId = req.query.apartmentId || null;
    if (apartmentId && !isUuid(apartmentId)) {
      const error = new Error("That apartment id is not valid.");
      error.status = 400;
      throw error;
    }
    res.json(await listChanges({ apartmentId, type: req.query.type, limit: req.query.limit }));
  } catch (error) {
    next(error);
  }
}

export function schedulerStatusHandler(_req, res) {
  res.json({ ok: true, scheduler: schedulerStatus() });
}

async function loadApartment(id) {
  if (!isUuid(id)) {
    const error = new Error("That apartment id is not valid.");
    error.status = 400;
    throw error;
  }
  const apartment = await getApartmentRow(id);
  if (!apartment) {
    const error = new Error("Apartment not found.");
    error.status = 404;
    throw error;
  }
  return apartment;
}
