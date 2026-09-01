import { DESC_SORT_KEYS } from "@shared/listingView.js";

export default function FilterBar({ filters, onChange, showSort = false, showApartmentSort = false }) {
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

      <div className="filter-primary">
        <label className="filter-group">
          <span className="filter-group-label">Rent</span>
          <div className="filter-inline">
            <span className="filter-prefix">≤ $</span>
            <input
              className="filter-input"
              type="number"
              min="0"
              placeholder="Any"
              value={filters.maxRent}
              onChange={set("maxRent")}
            />
          </div>
        </label>

        <label className="filter-group">
          <span className="filter-group-label">Sqft</span>
          <div className="filter-range">
            <input
              className="filter-input"
              type="number"
              min="0"
              placeholder="Min"
              value={filters.minSqft}
              onChange={set("minSqft")}
            />
            <span className="filter-range-sep">–</span>
            <input
              className="filter-input"
              type="number"
              min="0"
              placeholder="Max"
              value={filters.maxSqft}
              onChange={set("maxSqft")}
            />
          </div>
        </label>

        <label className="filter-group filter-group-select">
          <span className="filter-group-label">Beds</span>
          <select className="filter-input" value={filters.bedrooms} onChange={set("bedrooms")}>
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </label>

        <label className="filter-group filter-group-select">
          <span className="filter-group-label">Baths</span>
          <select className="filter-input" value={filters.bathrooms} onChange={set("bathrooms")}>
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-group-label">Available by</span>
          <input className="filter-input" type="date" value={filters.availableBy} onChange={set("availableBy")} />
        </label>
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={filters.showDiscarded} onChange={set("showDiscarded")} />
          Show hidden
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.newOnly} onChange={set("newOnly")} />
          New only
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.priceDropsOnly} onChange={set("priceDropsOnly")} />
          Drops only
        </label>
        {showSort ? (
          <label className="filter-group filter-group-select filter-sort">
            <span className="filter-group-label">Sort</span>
            <select
              className="filter-input"
              value={filters.sort}
              onChange={(event) => {
                const sort = event.target.value;
                const sortDir = DESC_SORT_KEYS.has(sort) ? "desc" : "asc";
                onChange({ ...filters, sort, sortDir });
              }}
            >
              <option value="unit">Unit</option>
              {showApartmentSort ? <option value="building">Building</option> : null}
              <option value="price">Rent</option>
              <option value="beds">Bed / Bath</option>
              <option value="sqft">Square footage</option>
              <option value="availability">Availability</option>
              <option value="newest">Newest</option>
              <option value="changed">Recently changed</option>
              <option value="match">Match score</option>
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
