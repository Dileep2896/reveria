import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from '../firebase';
import './LibraryPage.css';

const API_URL = (() => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
})();

function useLibraryBooks(user) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'stories'),
          where('uid', '==', user.uid),
          where('status', 'in', ['draft', 'saved', 'completed']),
          orderBy('updated_at', 'desc'),
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const results = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled Story',
            cover_image_url: data.cover_image_url || null,
            total_scene_count: data.total_scene_count || 0,
            updated_at: data.updated_at?.toDate?.() || new Date(),
            is_public: data.is_public || false,
            status: data.status || 'draft',
            is_favorite: data.is_favorite || false,
            art_style: data.art_style || 'cinematic',
            title_generated: !!data.title_generated,
          };
        });
        setBooks(results);
      } catch (err) {
        console.error('Failed to load library:', err);
        if (!cancelled) setError('Failed to load library');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  return { books, setBooks, loading, error, refresh };
}

function BookCard({ book, onOpen, onDelete, onPublish, onUnpublish, onToggleFavorite }) {
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
            className={`book-3d-cover${!book.title_generated && book.total_scene_count > 0 ? ' book-3d-cover--generating' : ''}`}
            src={book.cover_image_url}
            alt={book.title}
            loading="lazy"
          />
        ) : (
          <div className="book-3d-cover book-3d-cover--placeholder">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
        )}

        {/* Cover generating overlay */}
        {!book.title_generated && book.total_scene_count > 0 && (
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
              <span>Painting cover…</span>
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
        <button
          className={`book-action-btn${book.is_favorite ? ' book-action-btn--fav-active' : ''}`}
          title={book.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite(book.id, !book.is_favorite)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={book.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {book.status === 'completed' && (
          <button
            className={`book-action-btn${book.is_public ? ' book-action-btn--pub-active' : ''}`}
            title={book.is_public ? 'Unpublish' : 'Publish to Explore'}
            onClick={() => book.is_public ? onUnpublish(book.id) : onPublish(book.id)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        )}

        <button
          className="book-action-btn book-action-btn--delete"
          title="Delete story"
          onClick={() => onDelete(book)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function LibraryPage({ user, onOpenBook, onNewStory, bookMeta, activeStoryId, onActiveStoryDeleted }) {
  const { idToken } = useAuth();
  const { addToast } = useToast();
  const { books, setBooks, loading, error, refresh } = useLibraryBooks(user);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null); // book to confirm delete
  const [deleting, setDeleting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  // Auto-refresh library when bookMeta arrives (cover finished generating)
  useEffect(() => {
    if (bookMeta) refresh();
  }, [bookMeta, refresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrolled((prev) => (prev ? el.scrollTop > 10 : el.scrollTop > 60));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Status / favorites filter
    switch (statusFilter) {
      case 'favorites':
        result = result.filter((b) => b.is_favorite);
        break;
      case 'saved':
        result = result.filter((b) => b.status === 'saved');
        break;
      case 'completed':
        result = result.filter((b) => b.status === 'completed');
        break;
      case 'published':
        result = result.filter((b) => b.is_public);
        break;
      default: // 'all'
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default: // 'recent'
        result.sort((a, b) => b.updated_at - a.updated_at);
    }

    return result;
  }, [books, searchQuery, sortBy, statusFilter]);

  const handleOpen = useCallback(async (book) => {
    try {
      const storyId = book.id;

      const scenesSnap = await getDocs(collection(db, 'stories', storyId, 'scenes'));
      const scenes = scenesSnap.docs
        .map((d) => d.data())
        .sort((a, b) => a.scene_number - b.scene_number);

      const gensSnap = await getDocs(collection(db, 'stories', storyId, 'generations'));
      const generations = gensSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            prompt: data.prompt,
            directorData: data.director_data || null,
            sceneNumbers: data.scene_numbers || [],
          };
        })
        .sort((a, b) => {
          const aFirst = a.sceneNumbers[0] ?? 0;
          const bFirst = b.sceneNumbers[0] ?? 0;
          return aFirst - bFirst;
        });

      onOpenBook({ storyId, scenes, generations, status: book.status, is_public: book.is_public, art_style: book.art_style });
    } catch (err) {
      console.error('Failed to open book:', err);
    }
  }, [onOpenBook]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/stories/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast('Story deleted', 'success');
      if (deleteTarget.id === activeStoryId) onActiveStoryDeleted?.();
      refresh();
    } catch (err) {
      console.error('Failed to delete book:', err);
      addToast('Failed to delete story', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleting, idToken, refresh, addToast, activeStoryId, onActiveStoryDeleted]);

  const handlePublish = useCallback(async (bookId) => {
    try {
      await updateDoc(doc(db, 'stories', bookId), {
        is_public: true,
        published_at: new Date(),
        author_name: user?.displayName || 'Anonymous',
        author_photo_url: user?.photoURL || null,
      });
      refresh();
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  }, [user, refresh]);

  const handleUnpublish = useCallback(async (bookId) => {
    try {
      await updateDoc(doc(db, 'stories', bookId), { is_public: false });
      refresh();
    } catch (err) {
      console.error('Failed to unpublish:', err);
    }
  }, [refresh]);

  const handleToggleFavorite = useCallback(async (bookId, newValue) => {
    // Optimistic update — no reload/skeleton
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_favorite: newValue } : b));
    try {
      await updateDoc(doc(db, 'stories', bookId), { is_favorite: newValue });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on failure
      setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_favorite: !newValue } : b));
    }
  }, [setBooks]);

  const stickyHeader = (compact) => (
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

  if (loading) {
    return (
      <div className="library-container" ref={containerRef}>
        {stickyHeader(false)}
        <div className="library-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="book-container" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="book-3d book-3d--skeleton">
                <div className="book-3d-cover book-3d-cover--placeholder book-3d-skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-container" ref={containerRef}>
        <div className="library-empty">
          <p style={{ color: 'var(--status-error)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="library-container" ref={containerRef}>
        {stickyHeader(false)}
        <div className="library-empty">
          {/* Stacked books visual */}
          <div className="library-empty-visual">
            <div className="library-empty-book library-empty-book-1" />
            <div className="library-empty-book library-empty-book-2" />
            <div className="library-empty-book library-empty-book-3" />
          </div>

          <h3>Your library is empty</h3>
          <p>
            Stories you save will appear here. Create a story with 2+ scenes and
            hit Save to start building your collection.
          </p>

          <button className="library-empty-cta" onClick={onNewStory}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Create a Story
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="library-container" ref={containerRef}>
      {stickyHeader(scrolled)}

      {filteredBooks.length === 0 ? (
        <div className="library-filter-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <p>
            {statusFilter === 'favorites' ? 'No favorite stories yet'
              : statusFilter === 'saved' ? 'No saved stories'
              : statusFilter === 'completed' ? 'No completed stories'
              : statusFilter === 'published' ? 'No published stories yet'
              : `No stories matching "${searchQuery}"`}
          </p>
        </div>
      ) : (
        <div className="library-grid">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onOpen={handleOpen}
              onDelete={setDeleteTarget}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}

        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="library-delete-overlay"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="library-delete-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="library-delete-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h3 className="library-delete-title">Delete This Story?</h3>

            <div className="library-delete-divider" />

            <p className="library-delete-book-name">{deleteTarget.title}</p>
            <p className="library-delete-desc">
              This will permanently delete the story, all scenes, and generated media. This action cannot be undone.
            </p>

            <div className="library-delete-actions">
              <button
                className="library-delete-btn library-delete-btn--cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="library-delete-btn library-delete-btn--confirm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="library-delete-spinner" />
                    Deleting…
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
