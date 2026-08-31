import { launcherStatus, requestDevStart } from "./devLauncher.js";

const DEFAULT_API_URL = "http://127.0.0.1:8787";

export function getApiUrl() {
  return DEFAULT_API_URL;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiAvailable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 400);
    const response = await fetch(`${getApiUrl()}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for the API (starting dev via the local launcher if needed), then wake jobs.
 * Returns: ready | no-launcher | timeout
 */
export async function ensureBackendReady({ maxWaitMs = 45000 } = {}) {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    if (await apiAvailable()) {
      try {
        await apiRequest("/wake", { method: "POST" });
      } catch {
        // Wake is best-effort once health succeeds.
      }
      return "ready";
    }

    await requestDevStart();
    await sleep(1000);
  }

  if (await apiAvailable()) return "ready";
  return (await launcherStatus()) ? "timeout" : "no-launcher";
}

export async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }
  return data;
}

export async function apiListApartments() {
  if (!(await apiAvailable())) return null;
  return apiRequest("/apartments");
}

export async function apiCreateApartment({ name, url }) {
  return apiRequest("/apartments", { method: "POST", body: { name, url } });
}

export async function apiDeleteApartment(id) {
  return apiRequest(`/apartments/${id}`, { method: "DELETE" });
}

export async function apiReportScrape(id, payload) {
  return apiRequest(`/apartments/${id}/scrape`, { method: "POST", body: payload });
}

export async function apiListChanges({ limit = 30 } = {}) {
  if (!(await apiAvailable())) return [];
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiRequest(`/changes${query ? `?${query}` : ""}`);
}
