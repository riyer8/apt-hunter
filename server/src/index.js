import cors from "cors";
import express from "express";
import { migrate } from "./db.js";
import {
  apartmentsRouter,
  listChangesHandler,
  listingsRouter,
  notificationsRouter,
  preferencesRouter,
  schedulerStatusHandler,
  wakeHandler,
} from "./routes.js";
import { startScheduler } from "./scheduler.js";
import { closeBrowser } from "./scraper.js";
import { backfillMissingBuildingProfiles } from "./buildingAnalyze.js";

const app = express();
const port = Number(process.env.PORT) || 8787;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", schedulerStatusHandler);
app.post("/wake", wakeHandler);

app.get("/changes", listChangesHandler);
app.use("/notifications", notificationsRouter);
app.use("/preferences", preferencesRouter);

app.use("/apartments", apartmentsRouter);
app.use("/listings", listingsRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Something went wrong.",
  });
});

await migrate();
backfillMissingBuildingProfiles().catch((error) => {
  console.error("Building profile backfill failed:", error.message);
});
startScheduler();

async function shutdown() {
  await closeBrowser().catch(() => {});
}

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

app.listen(port, () => {
  console.log(`AptWatch API on http://127.0.0.1:${port}`);
});
