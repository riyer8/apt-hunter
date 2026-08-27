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
      </div>

      <div className="toggles">
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
                const sortDir = sort === "newest" || sort === "changed" ? "desc" : "asc";
                onChange({ ...filters, sort, sortDir });
              }}
            >
              <option value="unit">Unit</option>
              <option value="price">Price</option>
              <option value="beds">Beds</option>
              <option value="sqft">Square footage</option>
              <option value="availability">Availability date</option>
              <option value="newest">Newest</option>
              <option value="changed">Recently changed</option>
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
