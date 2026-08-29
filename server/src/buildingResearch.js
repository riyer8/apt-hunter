import { getBrowser } from "./scraper.js";
import { inferNeighborhood } from "./buildingProfilePrompt.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const PAGE_TIMEOUT_MS = 22000;
const RENDER_WAIT_MS = 3500;
const MAX_SOURCE_CHARS = 10000;

export async function gatherBuildingResearch(apartment) {
  const name = apartment.name || "Unknown building";
  const location = apartment.location || inferNeighborhood(name) || "San Francisco, CA";
  const sources = [];
  const seen = new Set();

  const add = (entry) => {
    const text = normalizeText(entry.text);
    if (!text) return;
    const key = `${entry.url || entry.title}:${text.slice(0, 240)}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ ...entry, text: text.slice(0, MAX_SOURCE_CHARS) });
  };

  for (const url of officialUrls(apartment.source_url || apartment.url)) {
    const text = await fetchPageText(url);
    if (text) add({ url, title: "Official website", text });
  }

  const yelp = await fetchYelpListing(name, location);
  if (yelp) add(yelp);

  const google = await fetchGoogleReviewSnippets(name, location);
  if (google) add(google);

  return sources;
}

function officialUrls(url) {
  if (!url) return [];
  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    add(parsed.toString());

    const segments = parsed.pathname.split("/").filter(Boolean);
    const trimmed = [...segments];
    while (trimmed.length > 0) {
      const last = trimmed[trimmed.length - 1];
      if (/^(floorplans?|availability|homes|unit-listings?|apartments|apply)$/i.test(last)) {
        trimmed.pop();
        add(`${parsed.origin}/${trimmed.join("/")}/`);
        continue;
      }
      break;
    }
  } catch {
    add(url);
  }

  return candidates;
}

async function fetchYelpListing(name, location) {
  const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(location)}`;
  return withPage(async (page) => {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(RENDER_WAIT_MS);

    const bizUrl = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="/biz/"]')];
      const hit = links.find((link) => /\/biz\//.test(link.getAttribute("href") || ""));
      if (!hit) return null;
      try {
        return new URL(hit.getAttribute("href"), location.origin).href;
      } catch {
        return hit.href || null;
      }
    });

    if (bizUrl) {
      await page.goto(bizUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(RENDER_WAIT_MS);
      const text = await page.innerText("body");
      return { url: bizUrl, title: "Yelp — resident reviews", text };
    }

    const text = await page.innerText("body");
    return text ? { url: searchUrl, title: "Yelp search results", text } : null;
  });
}

async function fetchGoogleReviewSnippets(name, location) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} apartment reviews ${location}`)}`;
  return withPage(async (page) => {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(RENDER_WAIT_MS);
    const text = await page.innerText("body");
    if (!text || /unusual traffic|captcha|consent/i.test(text)) return null;
    return { url: searchUrl, title: "Google review snippets", text };
  });
}

async function fetchPageText(url) {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(RENDER_WAIT_MS);
    return page.innerText("body");
  });
}

async function withPage(run) {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: "en-US" });
  const page = await context.newPage();
  try {
    return await run(page);
  } catch (error) {
    console.warn("Building research fetch failed:", error.message);
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
