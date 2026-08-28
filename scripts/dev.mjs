#!/usr/bin/env node
/**
 * Start Postgres (Docker), the API, and the Vite dashboard together.
 * Run from the repo root: npm run dev
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:8787";

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return true;
    } catch {
      // API still starting.
    }
    await sleep(750);
  }
  return false;
}

async function startPostgres() {
  console.log("Starting Postgres (docker compose)…");
  await new Promise((resolve) => {
    const child = run("docker", ["compose", "up", "-d"], { stdio: "pipe" });
    child.on("exit", (code) => {
      if (code !== 0) console.log("Docker compose skipped — using existing Postgres if available.");
      resolve();
    });
    child.on("error", () => {
      console.log("Docker not available — using existing Postgres if available.");
      resolve();
    });
  });
  await sleep(2000);
}

const children = [];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await startPostgres();

console.log("Starting AptWatch API…");
children.push(run("npm", ["run", "dev"], { cwd: path.join(root, "server") }));

const healthy = await waitForHealth();
if (!healthy) {
  console.error(`API did not become healthy at ${API_URL}. Check server logs and DATABASE_URL.`);
  shutdown();
}

try {
  await fetch(`${API_URL}/wake`, { method: "POST" });
} catch {
  // Wake is best-effort during dev startup.
}

console.log("Starting dashboard…");
children.push(run("npm", ["run", "dev"], { cwd: path.join(root, "web") }));

await new Promise(() => {});
