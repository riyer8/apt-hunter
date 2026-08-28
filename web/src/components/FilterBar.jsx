import { DESC_SORT_KEYS } from "@shared/listingView.js";

export default function FilterBar({ filters, onChange, showSort = false }) {
  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="toolbar">
      <input
        className="search"
        type="search"
        placeholder="Search buildings, neighborhoods, or unit numbers"
        value={filters.query}
        onChange={set("query")}
      />

      <div className="filters">
        <label className="field">
          <span>Max rent</span>
          <input type="number" min="0" placeholder="Any" value={filters.maxRent} onChange={set("maxRent")} />
        </label>
        <label className="field">
          <span>Min sqft</span>
          <input type="number" min="0" placeholder="Any" value={filters.minSqft} onChange={set("minSqft")} />
        </label>
        <label className="field">
          <span>Max sqft</span>
          <input type="number" min="0" placeholder="Any" value={filters.maxSqft} onChange={set("maxSqft")} />
        </label>
        <label className="field">
          <span>Bedrooms</span>
          <select value={filters.bedrooms} onChange={set("bedrooms")}>
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </label>
        <label className="field">
          <span>Bathrooms</span>
          <select value={filters.bathrooms} onChange={set("bathrooms")}>
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
          </select>
        </label>
        <label className="field">
          <span>Available by</span>
          <input type="date" value={filters.availableBy} onChange={set("availableBy")} />
        </label>
        <label className="field">
          <span>Min safety</span>
          <input type="number" min="0" max="10" step="0.1" placeholder="Any" value={filters.minSafety} onChange={set("minSafety")} />
        </label>
        <label className="field">
          <span>Min walkability</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            placeholder="Any"
            value={filters.minWalkability}
            onChange={set("minWalkability")}
          />
        </label>
        <label className="field">
          <span>Show</span>
          <select value={filters.selectionScope || ""} onChange={set("selectionScope")}>
            <option value="">All buildings</option>
            <option value="favorite">Favorites only</option>
            <option value="watchlist">Watchlist only</option>
          </select>
        </label>
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={filters.showDiscarded} onChange={set("showDiscarded")} />
          Show hidden buildings & units
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.newOnly} onChange={set("newOnly")} />
          NEW listings only
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.priceDropsOnly} onChange={set("priceDropsOnly")} />
          Price drops only
        </label>
        {showSort ? (
          <label className="field" style={{ minWidth: 180 }}>
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) => {
                const sort = event.target.value;
                const sortDir = DESC_SORT_KEYS.has(sort) ? "desc" : "asc";
                onChange({ ...filters, sort, sortDir });
              }}
            >
              <option value="unit">Unit</option>
              <option value="price">Rent</option>
              <option value="beds">Bed / Bath</option>
              <option value="sqft">Square footage</option>
              <option value="availability">Availability date</option>
              <option value="newest">Newest</option>
              <option value="changed">Recently changed</option>
              <option value="match">Match score</option>
              <option value="safety">Safety</option>
              <option value="buildingAge">Building Age</option>
              <option value="walkability">Walkability</option>
              <option value="viewsSun">Views/Sun</option>
              <option value="amenities">Amenities</option>
              <option value="overall">Overall building score</option>
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
