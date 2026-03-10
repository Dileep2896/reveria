import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  db,
  collection,
  getDocs,
  doc,
  updateDoc,
} from '../firebase';
import useLibraryBooks from '../hooks/useLibraryBooks';
import BookCard from './library/BookCard';
import LibraryHeader from './library/LibraryHeader';
import DeleteConfirmDialog from './library/DeleteConfirmDialog';
import './LibraryPage.css';

const API_URL = (() => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
})();

export default function LibraryPage({ user, onOpenBook, onNewStory, bookMeta, activeStoryId, onActiveStoryDeleted }) {
  const navigate = useNavigate();
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
    // Published books go to the Book Details page
    if (book.is_public) {
      navigate(ROUTES.BOOK(book.id), { state: { from: 'library' } });
      return;
    }

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
            directorLiveNotes: data.director_live_notes || [],
            sceneNumbers: data.scene_numbers || [],
          };
        })
        .sort((a, b) => {
          const aFirst = a.sceneNumbers[0] ?? 0;
          const bFirst = b.sceneNumbers[0] ?? 0;
          return aFirst - bFirst;
        });

      onOpenBook({ storyId, scenes, generations, status: book.status, is_public: book.is_public, art_style: book.art_style, language: book.language, portraits: book.portraits });
    } catch (err) {
      console.error('Failed to open book:', err);
    }
  }, [onOpenBook, navigate]);

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

  const handleToggleFavorite = useCallback(async (bookId, newValue) => {
    // Optimistic update - no reload/skeleton
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_favorite: newValue } : b));
    try {
      await updateDoc(doc(db, 'stories', bookId), { is_favorite: newValue });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on failure
      setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_favorite: !newValue } : b));
    }
  }, [setBooks]);

  const handleRegenMeta = useCallback(async (bookId) => {
    // Optimistic: show shimmer
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, _regenMeta: true } : b));
    try {
      const res = await fetch(`${API_URL}/api/stories/${bookId}/regenerate-meta`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBooks((prev) => prev.map((b) => b.id === bookId ? {
        ...b,
        title: data.title || b.title,
        cover_image_url: data.cover_image_url || b.cover_image_url,
        title_generated: true,
        cover_generated: !!data.cover_image_url,
        _regenMeta: false,
      } : b));
      addToast('Cover & title regenerated!', 'success');
    } catch (err) {
      console.error('Failed to regenerate meta:', err);
      setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, _regenMeta: false } : b));
      addToast('Failed to regenerate cover', 'error');
    }
  }, [idToken, setBooks, addToast]);

  const headerProps = {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    filteredBooks,
    onNewStory,
  };

  if (loading) {
    return (
      <div className="library-container" ref={containerRef}>
        <LibraryHeader compact={false} {...headerProps} />
        <div className="library-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="library-skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="library-skeleton-cover" />
              <div className="library-skeleton-meta">
                <div className="library-skeleton-line library-skeleton-line--title" />
                <div className="library-skeleton-line library-skeleton-line--subtitle" />
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
        <LibraryHeader compact={false} {...headerProps} />
        <div className="library-empty">
          {/* Floating books visual */}
          <div className="library-empty-visual">
            <div className="library-empty-book library-empty-book-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div className="library-empty-book library-empty-book-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div className="library-empty-book library-empty-book-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>

          <h3>Your bookshelf is waiting</h3>
          <p>
            Stories you create will live here. Start writing and save
            your first story to begin your collection.
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
      <LibraryHeader compact={scrolled} {...headerProps} />

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
              onToggleFavorite={handleToggleFavorite}
              onRegenMeta={handleRegenMeta}
            />
          ))}

        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          deleteTarget={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
