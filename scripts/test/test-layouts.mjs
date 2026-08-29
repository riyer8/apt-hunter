import { extractFromHtml } from "./extractFromHtml.mjs";

const layouts = [
  {
    name: "RentCafe-style unit table",
    url: "https://www.rentcafe.com/apartments/wi/oak-creek/southfield/default.aspx",
    apartmentName: "Southfield",
    html: `<html><body>
      <h1>Southfield Apartments</h1>
      <h3>1 Bed, 1 Bath</h3>
      <table>
        <thead><tr><th>Unit</th><th>Total monthly cost</th><th>Sq. Ft.</th><th>Availability</th></tr></thead>
        <tbody>
          <tr><td>6931-D01</td><td>$1,386 - $1,868</td><td>750 sq. ft.</td><td>Jun 16, 2026</td></tr>
          <tr><td>1481G15</td><td>$1,376</td><td>742 sq. ft.</td><td>Available 08/03/2026</td></tr>
        </tbody>
      </table>
    </body></html>`,
  },
  {
    name: "JSON-LD apartment offers",
    url: "https://example.com/jsonld",
    apartmentName: "The Helix",
    html: `<html><body>
      <script type="application/ld+json">
        [
          {"@type":"Apartment","unitNumber":"1204","numberOfBedrooms":1,"numberOfBathroomsTotal":1,"floorSize":{"value":620},"offers":{"@type":"Offer","price":3995,"availabilityStarts":"2026-09-20","url":"https://example.com/u/1204"}},
          {"@type":"Apartment","unitNumber":"903","numberOfBedrooms":1,"numberOfBathroomsTotal":1,"floorSize":{"value":650},"offers":{"@type":"Offer","price":4150,"availabilityStarts":"2026-09-18","url":"https://example.com/u/903"}}
        ]
      </script>
    </body></html>`,
  },
  {
    name: "Avalon-style listing cards",
    url: "https://new.avaloncommunities.com/washington/newcastle-apartments/avalon-newcastle-commons/",
    apartmentName: "Avalon Newcastle Commons",
    html: `<html><body>
      <section>
        <article>
          <h2>03A-431 Avalon Newcastle Commons</h2>
          <p>Studio • 1 bath • 546 sqft</p>
          <p>Base rent starting at $2,105 / 12 mo. lease</p>
          <p>Available starting Sep 15</p>
          <a href="https://www.avaloncommunities.com/washington/newcastle-apartments/avalon-newcastle-commons/apartment/WA029-03A-431/">View Details</a>
        </article>
        <article>
          <h2>06A-215 Avalon Newcastle Commons</h2>
          <p>1 bed • 1 bath • 664 sqft</p>
          <p>Base rent starting at $2,345 / 12 mo. lease</p>
          <p>Available starting Oct 12</p>
          <a href="https://www.avaloncommunities.com/washington/newcastle-apartments/avalon-newcastle-commons/apartment/WA029-06A-215/">View Details</a>
        </article>
        <article>
          <h2>04A-304 Avalon Newcastle Commons</h2>
          <p>1 bed • 1 bath • 754 sqft</p>
          <p>Base rent starting at $2,365 / 12 mo. lease</p>
          <p>Available starting Sep 8</p>
          <a href="https://www.avaloncommunities.com/washington/newcastle-apartments/avalon-newcastle-commons/apartment/WA029-04A-304/">View Details</a>
        </article>
      </section>
    </body></html>`,
  },
  {
    name: "Embedded JavaScript state",
    url: "https://www.equityapartments.com/boston/west-end/alcott-apartments",
    apartmentName: "Alcott",
    html: `<html><body>
      <script>
        window.__NEXT_DATA__ = ${JSON.stringify({
          props: {
            pageProps: {
              units: [
                { unitNumber: "30G", price: 3875, bedrooms: 0, bathrooms: 1, sqft: 617, availableDate: "2026-09-18", url: "/units/30g", floorPlanName: "S1" },
                { unitNumber: "25B", minRent: 4160, beds: 1, baths: 1, squareFeet: 721, availableOn: "09/20/2026", applyUrl: "/units/25b", planName: "A2" },
              ],
            },
          },
        })};
      </script>
    </body></html>`,
  },
  {
    name: "Avalon Fusion.globalContent units",
    url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/",
    apartmentName: "Avalon Dogpatch",
    html: `<html><body>
      <h5>studio From</h5>
      <a href="#community-unit-listings">$3,955</a>
      <div class="unit-item">
        <h2>00B-143 Avalon Dogpatch</h2>
        <p>Studio • 1 bath • 482 sqft</p>
        <p>Base rent starting at $3,955 / 13 mo. lease</p>
        <p>Available starting Oct 02</p>
        <a href="https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00B-143/">View Details</a>
      </div>
      <script>
        window.Fusion = window.Fusion || {};
        Fusion.globalContent = ${JSON.stringify({
          communityId: "AVB-CA117",
          name: "Avalon Dogpatch",
          url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/",
          units: [
            {
              unitId: "AVB-CA117-00B-143",
              unitName: "143",
              url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00B-143",
              bedroomNumber: 0,
              bathroomNumber: 1,
              squareFeet: 482,
              floorPlan: { name: "S3-482SF" },
              startingAtPricesUnfurnished: { prices: { price: 3955 } },
              availableDateUnfurnished: "2026-10-02T04:00:00+00:00",
            },
            {
              unitId: "AVB-CA117-00B-368",
              unitName: "368",
              url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00B-368",
              bedroomNumber: 0,
              bathroomNumber: 1,
              squareFeet: 436,
              floorPlan: { name: "S2-436SF" },
              startingAtPricesUnfurnished: { prices: { price: 3980 } },
              availableDateUnfurnished: "2026-08-28T04:00:00+00:00",
            },
            {
              unitId: "AVB-CA117-00C-175",
              unitName: "175",
              url: "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/apartment/CA117-CA117-00C-175",
              bedroomNumber: 1,
              bathroomNumber: 1,
              squareFeet: 545,
              floorPlan: { name: "A1-545SF" },
              startingAtPricesUnfurnished: { prices: { price: 4240 } },
              availableDateUnfurnished: "2026-09-27T04:00:00+00:00",
            },
          ],
        })};
      </script>
    </body></html>`,
  },
  {
    name: "Unstructured DOM cards",
    url: "https://www.apartments.com/example",
    apartmentName: "Tracy Ave",
    html: `<html><body>
      <ul>
        <li class="card">Unit 14044-3E · 2 Bed / 1 Bath · 900 sq. ft. · $1,350 / month · Available Now <a href="/apply/3e">Apply</a></li>
        <li class="card">Unit 14044-2B · 1 Bed / 1 Bath · 720 sq. ft. · $1,225 / month · Available 10/01/2026 <a href="/apply/2b">Apply</a></li>
      </ul>
    </body></html>`,
  },
  {
    name: "SightMap JSON-LD apartments plus offers",
    url: "https://www.quincysf.com/floor-plans-and-availability/",
    apartmentName: "Quincy",
    html: `<html><body>
      <script type="application/ld+json">
        ${JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["RealEstateListing", "Product"],
          name: "Quincy",
          about: {
            "@type": "ApartmentComplex",
            name: "Quincy",
            containsPlace: [
              {
                "@type": "Apartment",
                name: "APT 0306",
                numberOfBedrooms: 0,
                numberOfBathroomsTotal: 1,
                floorSize: { "@type": "QuantitativeValue", value: 577, unitCode: "FTK" },
              },
              {
                "@type": "Apartment",
                name: "APT 1121",
                numberOfBedrooms: 1,
                numberOfBathroomsTotal: 1,
                floorSize: { "@type": "QuantitativeValue", value: 582, unitCode: "FTK" },
              },
            ],
          },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: 4186,
            highPrice: 5163,
            offerCount: 2,
            offers: [
              {
                "@type": "Offer",
                name: "APT 1121",
                availabilityStarts: "2026-10-19",
                price: 5163,
              },
              {
                "@type": "Offer",
                name: "APT 0306",
                availabilityStarts: "2026-10-14",
                price: 4186,
              },
            ],
          },
        })}
      </script>
      <div>APT 0306S7 Studio / 1 Bath / 577 sq. ft. Available Oct 14th $4,186 - $4,196 /mo* $4,161 Base Rent</div>
    </body></html>`,
  },
  {
    name: "Windsor Spaces unit cards",
    url: "https://www.windsorcommunities.com/properties/windsor-at-dogpatch/floorplans/",
    apartmentName: "Windsor at Dogpatch",
    html: `<html><body>
      <article class="spaces-unit" data-spaces-unit="520" data-spaces-sort-price="4837" data-spaces-sort-plan-name="A3" data-spaces-sort-bed="1" data-spaces-sort-bath="1" data-spaces-sort-area="643" data-spaces-soonest="2026-09-01" data-spaces-href="?spaces_tab=unit-detail&detail=5360253" aria-label="Unit 520">
        520 $4,840.65 /mo 13 Mo. Avail. Sep 01 1 Bed 1 Bath 643 Sq. Ft. A3 Windsor at Dogpatch
      </article>
      <article class="spaces-unit" data-spaces-unit="203" data-spaces-sort-price="4071" data-spaces-sort-plan-name="S1" data-spaces-sort-bed="0" data-spaces-sort-bath="1" data-spaces-sort-area="473" data-spaces-soonest="2026-09-16" data-spaces-href="?spaces_tab=unit-detail&detail=5360210" aria-label="Unit 203">
        203 $4,074.65 /mo 15 Mo. Avail. Sep 16 Studio 1 Bath 473 Sq. Ft. S1 Windsor at Dogpatch
      </article>
    </body></html>`,
  },
];

function summarize(layout, extracted) {
  const listings = extracted.listings;
  const fields = ["unit", "price", "bedrooms", "bathrooms", "sqft", "availableDate", "floorPlan", "listingUrl"];
  return {
    name: layout.name,
    url: layout.url,
    outcome: extracted.result.outcome,
    listingCount: listings.length,
    fieldsPresent: fields.filter((field) => listings.some((item) => item[field] != null)),
    fieldsMissing: fields.filter((field) => listings.every((item) => item[field] == null)),
    confidence: listings.reduce((counts, item) => {
      counts[item.confidence] = (counts[item.confidence] || 0) + 1;
      return counts;
    }, {}),
    strategies: extracted.result.strategies,
    sample: listings.map((item) => ({
      unit: item.unit,
      price: item.price,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      sqft: item.sqft,
      availableDate: item.availableDate,
      confidence: item.confidence,
      source: item.source,
    })),
  };
}

const reports = layouts.map((layout) =>
  summarize(layout, extractFromHtml(layout.html, { url: layout.url, apartmentName: layout.apartmentName })),
);
console.log(JSON.stringify(reports, null, 2));
