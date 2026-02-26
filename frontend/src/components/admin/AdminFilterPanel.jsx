import { TIER_OPTIONS, PROVIDER_OPTIONS, VERIFIED_OPTIONS, SORT_OPTIONS } from './adminHelpers';

export default function AdminFilterPanel({ search, setSearch, filterTier, setFilterTier, filterProvider, setFilterProvider, filterVerified, setFilterVerified, sortBy, setSortBy, hasActiveFilters, clearFilters }) {
  return (
    <>
      {/* Search */}
      <div className="admin-search-row">
        <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="admin-search"
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {(search || hasActiveFilters) && (
          <button className="admin-search-clear" onClick={() => { setSearch(''); clearFilters(); }} title="Clear all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          <span className="admin-filter-label">Tier</span>
          <div className="admin-filter-pills">
            {TIER_OPTIONS.map(t => (
              <button
                key={t}
                className={`admin-filter-pill${filterTier === t ? ' admin-filter-pill--active' : ''}${t !== 'all' ? ` admin-filter-pill--${t}` : ''}`}
                onClick={() => setFilterTier(t)}
              >
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-filter-group">
          <span className="admin-filter-label">Provider</span>
          <div className="admin-filter-pills">
            {PROVIDER_OPTIONS.map(([val, label]) => (
              <button
                key={val}
                className={`admin-filter-pill${filterProvider === val ? ' admin-filter-pill--active' : ''}`}
                onClick={() => setFilterProvider(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-filter-group">
          <span className="admin-filter-label">Status</span>
          <div className="admin-filter-pills">
            {VERIFIED_OPTIONS.map(([val, label]) => (
              <button
                key={val}
                className={`admin-filter-pill${filterVerified === val ? ' admin-filter-pill--active' : ''}${val === 'yes' ? ' admin-filter-pill--verified' : ''}${val === 'no' ? ' admin-filter-pill--unverified' : ''}`}
                onClick={() => setFilterVerified(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-filter-group">
          <span className="admin-filter-label">Sort</span>
          <div className="admin-filter-pills">
            {SORT_OPTIONS.map(([val, label]) => (
              <button
                key={val}
                className={`admin-filter-pill${sortBy === val ? ' admin-filter-pill--active' : ''}`}
                onClick={() => setSortBy(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
