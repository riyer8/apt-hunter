import cors from "cors";
import express from "express";
import { migrate } from "./db.js";
import { apartmentsRouter } from "./routes.js";

const app = express();
const port = Number(process.env.PORT) || 8787;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/apartments", apartmentsRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Something went wrong.",
  });
});

await migrate();

app.listen(port, () => {
  console.log(`AptWatch API on http://127.0.0.1:${port}`);
});
