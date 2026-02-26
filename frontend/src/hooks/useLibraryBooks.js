import { useState, useEffect, useCallback } from 'react';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from '../firebase';

export default function useLibraryBooks(user) {
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
            language: data.language || 'English',
            portraits: data.portraits || [],
            title_generated: !!data.title_generated
              || (Date.now() - (data.updated_at?.toDate?.()?.getTime() || 0) > 2 * 60 * 1000),
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
