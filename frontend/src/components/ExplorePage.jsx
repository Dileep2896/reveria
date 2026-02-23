import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from '../firebase';
import './LibraryPage.css';
import './ExplorePage.css';

function usePublicBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'stories'),
          where('is_public', '==', true),
          orderBy('published_at', 'desc'),
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
            published_at: data.published_at?.toDate?.() || new Date(),
            author_name: data.author_name || 'Anonymous',
            author_photo_url: data.author_photo_url || null,
            author_uid: data.uid || null,
            status: data.status || 'completed',
            is_public: true,
            liked_by: data.liked_by || [],
          };
        });
        setBooks(results);
      } catch (err) {
        console.error('Failed to load public stories:', err);
        if (!cancelled) setError('Failed to load public stories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { books, setBooks, loading, error };
}

function PublicBookCard({ book, onOpen, onToggleLike, userId }) {
  const dateStr = book.published_at.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const liked = userId && book.liked_by.includes(userId);
  const likeCount = book.liked_by.length;

  return (
    <div className="book-container">
      <div className="book-3d" onClick={() => onOpen(book)}>
        {book.cover_image_url ? (
          <img
            className="book-3d-cover"
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

        {/* Title overlay on front cover */}
        <div className="book-3d-info">
          <p className="book-3d-title" title={book.title}>{book.title}</p>
          <div className="book-3d-meta">
            <span><strong>{book.total_scene_count}</strong> scenes</span>
            <span className="book-3d-meta-dot" />
            <span>{dateStr}</span>
          </div>
        </div>
      </div>

      {/* Author + like row below book */}
      <div className="explore-book-footer">
        <div className="explore-book-author">
          {book.author_photo_url ? (
            <img
              className="explore-book-avatar"
              src={book.author_photo_url}
              alt={book.author_name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="explore-book-avatar explore-book-avatar--fallback">
              {(book.author_name || '?')[0].toUpperCase()}
            </div>
          )}
          <span className="explore-book-author-name">{book.author_name}</span>
        </div>

        {userId && (
          <button
            className={`explore-book-like${liked ? ' explore-book-like--active' : ''}`}
            title={liked ? 'Unlike' : 'Like'}
            onClick={() => onToggleLike(book.id, !liked)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likeCount > 0 && <span className="explore-book-like-count">{likeCount}</span>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage({ user, onOpenBook }) {
  const navigate = useNavigate();
  const { books, setBooks, loading, error } = usePublicBooks();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showLiked, setShowLiked] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      // Hysteresis: enter compact at 60px, exit at 10px — prevents flicker
      setScrolled((prev) => (prev ? el.scrollTop > 10 : el.scrollTop > 60));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleToggleLike = useCallback(async (bookId, shouldLike) => {
    if (!user) return;
    const uid = user.uid;
    // Optimistic update
    setBooks((prev) => prev.map((b) => {
      if (b.id !== bookId) return b;
      const newLikedBy = shouldLike
        ? [...b.liked_by, uid]
        : b.liked_by.filter((id) => id !== uid);
      return { ...b, liked_by: newLikedBy };
    }));
    try {
      await updateDoc(doc(db, 'stories', bookId), {
        liked_by: shouldLike ? arrayUnion(uid) : arrayRemove(uid),
      });
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert
      setBooks((prev) => prev.map((b) => {
        if (b.id !== bookId) return b;
        const reverted = shouldLike
          ? b.liked_by.filter((id) => id !== uid)
          : [...b.liked_by, uid];
        return { ...b, liked_by: reverted };
      }));
    }
  }, [user, setBooks]);

  const filteredBooks = useMemo(() => {
    let result = [...books];

    if (showLiked && user) {
      result = result.filter((b) => b.liked_by.includes(user.uid));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) =>
        b.title.toLowerCase().includes(q) || b.author_name.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        result.sort((a, b) => a.author_name.localeCompare(b.author_name));
        break;
      default: // 'recent'
        result.sort((a, b) => b.published_at - a.published_at);
    }

    return result;
  }, [books, searchQuery, sortBy, showLiked, user]);

  const handleOpen = useCallback((book) => {
    navigate(`/book/${book.id}`, { state: { from: 'explore' } });
  }, [navigate]);

  const stickyHeader = (compact) => (
    <div className={`explore-sticky-header${compact ? ' explore-sticky-header--compact' : ''}`}>
      <div className="explore-header-row">
        <h2 className="explore-title">Explore</h2>
        <div className="explore-search">
          <svg className="explore-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="explore-header-spacer" />
        {user && (
          <button
            className={`explore-liked-toggle${showLiked ? ' explore-liked-toggle--active' : ''}`}
            onClick={() => setShowLiked((v) => !v)}
            title={showLiked ? 'Show all' : 'Show liked only'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={showLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Favorites</span>
          </button>
        )}
      </div>
      <div className="explore-filter-row">
        <div className="explore-sort-pills">
          {['recent', 'title', 'author'].map((opt) => (
            <button
              key={opt}
              className={`explore-sort-pill${sortBy === opt ? ' explore-sort-pill--active' : ''}`}
              onClick={() => setSortBy(opt)}
            >
              {opt === 'recent' ? 'Recent' : opt === 'title' ? 'Title' : 'Author'}
            </button>
          ))}
        </div>
        <span className="explore-count">
          {filteredBooks.length} {filteredBooks.length === 1 ? 'story' : 'stories'}{searchQuery ? ' found' : ''}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="explore-container" ref={containerRef}>
        {stickyHeader(false)}
        <div className="library-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="explore-skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="explore-skeleton-cover" />
              <div className="explore-skeleton-meta">
                <div className="explore-skeleton-line explore-skeleton-line--title" />
                <div className="explore-skeleton-line explore-skeleton-line--subtitle" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explore-container" ref={containerRef}>
        <div className="explore-empty">
          <p style={{ color: 'var(--status-error)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="explore-container" ref={containerRef}>
        {stickyHeader(false)}
        <div className="explore-empty">
          <svg className="explore-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <h3>No published stories yet</h3>
          <p>Be the first to share! Save a story and hit the publish button in your Library.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="explore-container" ref={containerRef}>
      {stickyHeader(scrolled)}

      {filteredBooks.length === 0 ? (
        <div className="explore-filter-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <p>{showLiked ? 'No liked stories yet' : `No stories matching "${searchQuery}"`}</p>
        </div>
      ) : (
        <div className="library-grid">
          {filteredBooks.map((book) => (
            <PublicBookCard
              key={book.id}
              book={book}
              onOpen={handleOpen}
              onToggleLike={handleToggleLike}
              userId={user?.uid}
            />
          ))}
        </div>
      )}
    </div>
  );
}
