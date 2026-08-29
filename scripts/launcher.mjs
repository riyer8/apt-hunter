#!/usr/bin/env node
/**
 * Local dev helper: starts `npm run dev` when the extension or dashboard asks.
 * Run once per login (or install as a LaunchAgent — see npm run launcher:install).
 */
import { spawn } from "node:child_process";
import { openSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const devScript = join(root, "scripts", "dev.mjs");
const PORT = Number(process.env.APTWATCH_LAUNCHER_PORT) || 8799;
const API_URL = process.env.VITE_API_URL || process.env.API_URL || "http://127.0.0.1:8787";
const LOG_DIR = join(homedir(), "Library", "Logs", "AptWatch");

let devProcess = null;
let starting = false;

function log(...args) {
  console.log("[aptwatch launcher]", ...args);
}

async function apiHealthy() {
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

function devRunning() {
  return Boolean(devProcess && devProcess.exitCode == null && !devProcess.killed);
}

function startDev() {
  if (devRunning() || starting) return;
  starting = true;
  log("Starting dev stack…");

  const detached = !process.stdout.isTTY;
  let stdio = "inherit";

  if (detached) {
    mkdirSync(LOG_DIR, { recursive: true });
    const out = openSync(join(LOG_DIR, "dev.log"), "a");
    const err = openSync(join(LOG_DIR, "dev-error.log"), "a");
    stdio = ["ignore", out, err];
  }

  devProcess = spawn(process.execPath, [devScript], {
    cwd: root,
    detached,
    stdio,
    env: {
      ...process.env,
      PATH: ["/opt/homebrew/bin", "/usr/local/bin", process.env.PATH].filter(Boolean).join(":"),
    },
  });

  devProcess.on("error", (error) => {
    log(`dev failed to start: ${error.message}`);
    devProcess = null;
    starting = false;
  });

  devProcess.on("exit", (code, signal) => {
    log(`dev exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    devProcess = null;
    starting = false;
  });

  devProcess.on("spawn", () => {
    log(`dev pid ${devProcess.pid}`);
  });

  if (detached) {
    devProcess.unref();
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const path = req.url?.split("?")[0];

  if (req.method === "GET" && path === "/status") {
    sendJson(res, 200, {
      api: await apiHealthy(),
      dev: devRunning(),
      starting,
    });
    return;
  }

  if (req.method === "POST" && path === "/start") {
    if (await apiHealthy()) {
      sendJson(res, 200, { ok: true, api: true, started: false });
      return;
    }

    if (!devRunning() && !starting) startDev();
    sendJson(res, 202, { ok: true, api: false, started: true, starting: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log("Extension and dashboard can start the backend from here.");
});

process.on("SIGINT", () => {
  if (devProcess && !devProcess.killed) devProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  if (devProcess && !devProcess.killed) devProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
});
