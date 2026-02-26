import IconBtn from '../IconBtn';

export default function BookCard({ book, onOpen, onDelete, onToggleFavorite, onRegenMeta }) {
  const dateStr = book.updated_at.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="book-container">
      {/* .book-3d uses ::before (pages/spine) and ::after (back cover) for 3D */}
      <div className="book-3d" onClick={() => onOpen(book)}>
        {book.cover_image_url ? (
          <img
            className={`book-3d-cover${book._regenMeta ? ' book-3d-cover--generating' : ''}`}
            src={book.cover_image_url}
            alt={book.title}
            loading="lazy"
          />
        ) : (
          <div className="book-3d-cover book-3d-cover--placeholder">
            {book._regenMeta ? null : book.total_scene_count > 0 ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRegenMeta(book.id); }}
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: 'var(--accent-primary)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  backdropFilter: 'var(--glass-blur)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; e.currentTarget.style.borderColor = 'var(--glass-border-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Generate Cover
              </button>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            )}
          </div>
        )}

        {/* Cover generating overlay — only for active regen */}
        {book._regenMeta && (
          <div className="book-cover-generating">
            <div className="book-cover-generating-shimmer" />
            <div className="book-cover-generating-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <div className="book-cover-generating-label">
              <span>Generating…</span>
            </div>
          </div>
        )}

        {/* Title overlay on front cover */}
        <div className="book-3d-info">
          <p className="book-3d-title" title={book.title}>{book.title}</p>
          <div className="book-3d-meta">
            <span><strong>{book.total_scene_count}</strong> scenes</span>
            <span className="book-3d-meta-dot" />
            <span>{dateStr}</span>
          </div>
        </div>

        {/* Status badges */}
        <div className="book-3d-badges">
          <span className={`book-3d-badge book-3d-badge--${book.status}`}>
            {book.status === 'draft' ? 'Draft' : book.status === 'completed' ? 'Completed' : 'Saved'}
          </span>
          {book.is_public && (
            <span className="book-3d-badge book-3d-badge--published">Published</span>
          )}
        </div>
      </div>

      {/* Action bar below book */}
      <div className="book-action-bar">
        <IconBtn
          label={book.is_favorite ? 'Unfavorite' : 'Favorite'}
          size={28}
          active={book.is_favorite}
          activeColor="#ef4444"
          onClick={() => onToggleFavorite(book.id, !book.is_favorite)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={book.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </IconBtn>

        <IconBtn label="Delete" size={28} danger onClick={() => onDelete(book)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}
