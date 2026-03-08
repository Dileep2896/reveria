export default function LibraryHeader({ compact, searchQuery, setSearchQuery, statusFilter, setStatusFilter, sortBy, setSortBy, filteredBooks, onNewStory }) {
  return (
    <div className={`library-sticky-header${compact ? ' library-sticky-header--compact' : ''}`}>
      <div className="library-header-row">
        <h2 className="library-title">Your Library</h2>
        <div className="library-search">
          <svg className="library-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="library-header-spacer" />
        <button className="library-new-btn" onClick={onNewStory}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Story
        </button>
      </div>
      <div className="library-filter-row">
        <div className="library-filter-pills">
          {[
            { key: 'all', label: 'All' },
            { key: 'favorites', label: '\u2665 Favorites' },
            { key: 'saved', label: 'Saved' },
            { key: 'completed', label: 'Completed' },
            { key: 'published', label: 'Published' },
          ].map((opt) => (
            <button
              key={opt.key}
              className={`library-filter-pill${statusFilter === opt.key ? ' library-filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="library-sort-pills">
          {['recent', 'title'].map((opt) => (
            <button
              key={opt}
              className={`library-sort-pill${sortBy === opt ? ' library-sort-pill--active' : ''}`}
              onClick={() => setSortBy(opt)}
            >
              {opt === 'recent' ? 'Recent' : 'Title'}
            </button>
          ))}
        </div>
        <span className="library-count">
          {filteredBooks.length} {filteredBooks.length === 1 ? 'story' : 'stories'}{searchQuery ? ' found' : ''}
        </span>
      </div>
    </div>
  );
}
