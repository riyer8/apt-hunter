const DEFAULT_API_URL = "http://127.0.0.1:8787";

export function getApiUrl() {
  return DEFAULT_API_URL;
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
