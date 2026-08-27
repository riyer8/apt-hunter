import express from "express";
import {
  assembleApartments,
  createOrGetApartment,
  deleteApartment,
  getApartmentRow,
  listApartmentRows,
  listScrapeRuns,
  listingsForApartments,
  previousPricesFor,
  recordScrape,
} from "./store.js";
import { toApiListing, toApiScrapeRun } from "./serialize.js";
import { isUuid, parseApartmentInput, parseScrapeInput } from "./validate.js";

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

apartmentsRouter.get("/:id/scrape-history", async (req, res, next) => {
  try {
    await loadApartment(req.params.id);
    res.json(await listScrapeRuns(req.params.id));
  } catch (error) {
    next(error);
  }
});

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
