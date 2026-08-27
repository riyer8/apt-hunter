import { extractFromHtml } from "./extractFromHtml.mjs";

const SITES = [
  {
    name: "Equity — The Den",
    url: "https://www.equityapartments.com/denver/greenwood-village/the-den-apartments",
  },
  {
    name: "Equity — Alcott",
    url: "https://www.equityapartments.com/boston/west-end/alcott-apartments",
  },
  {
    name: "RentCafe — Southfield",
    url: "https://www.rentcafe.com/apartments/wi/oak-creek/southfield/default.aspx",
  },
  {
    name: "AvalonBay — Avalon Silicon Valley",
    url: "https://www.avaloncommunities.com/california/fremont-apartments/avalon-silicon-valley/",
  },
  {
    name: "Apartments.com — sample property",
    url: "https://www.apartments.com/southfield-apartments-oak-creek-wi/7k2j0v4/",
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  const html = await response.text();
  return { status: response.status, finalUrl: response.url, html };
}

function summarize(site, fetched, extracted) {
  const listings = extracted.listings || [];
  const fields = ["unit", "price", "bedrooms", "bathrooms", "sqft", "availableDate", "floorPlan", "listingUrl"];
  const present = fields.filter((field) => listings.some((listing) => listing[field] != null));
  const missing = fields.filter((field) => !present.includes(field));
  const confidence = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const strategies = {};
  for (const listing of listings) {
    confidence[listing.confidence] = (confidence[listing.confidence] || 0) + 1;
    strategies[listing.source] = (strategies[listing.source] || 0) + 1;
  }

  const blocked = /captcha|cloudflare|access denied|enable cookies/i.test(fetched.html) && listings.length === 0;

  return {
    name: site.name,
    url: site.url,
    httpStatus: fetched.status,
    blocked,
    outcome: extracted.result.outcome,
    listingCount: listings.length,
    fieldsPresent: present,
    fieldsMissing: missing,
    confidence,
    strategies,
    sample: listings.slice(0, 3).map((listing) => ({
      unit: listing.unit,
      price: listing.price,
      bedrooms: listing.bedrooms,
      sqft: listing.sqft,
      availableDate: listing.availableDate,
      confidence: listing.confidence,
      source: listing.source,
    })),
  };
}

const reports = [];
for (const site of SITES) {
  try {
    const fetched = await fetchHtml(site.url);
    const extracted = extractFromHtml(fetched.html, { url: site.url, apartmentName: site.name });
    reports.push(summarize(site, fetched, extracted));
  } catch (error) {
    reports.push({
      name: site.name,
      url: site.url,
      outcome: "FAILED",
      error: error.message,
      listingCount: 0,
    });
  }
}

console.log(JSON.stringify(reports, null, 2));
