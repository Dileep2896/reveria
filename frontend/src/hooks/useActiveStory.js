import { useState, useCallback, useEffect, useRef } from 'react';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
} from '../firebase';
import { loadStoryById } from '../utils/storyHelpers';

export default function useActiveStory(user, urlStoryId) {
  const [initialState, setInitialState] = useState(undefined);
  const [storyLoading, setStoryLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!user) {
      setInitialState(undefined);
      setStoryLoading(false);
      hasLoaded.current = false;
      return;
    }

    // Only load once per user session - subsequent navigation uses handleOpenBook/load
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    setStoryLoading(true);
    setInitialState(undefined);

    let cancelled = false;

    async function loadActiveStory() {
      try {
        let storyId = null;

        // If URL specifies a story, try loading it first
        if (urlStoryId) {
          const docSnap = await getDoc(doc(db, 'stories', urlStoryId));
          if (!cancelled && docSnap.exists() && docSnap.data().uid === user.uid) {
            storyId = urlStoryId;
          }
        }

        // Fallback: load most recently updated story
        if (!storyId) {
          const storiesRef = collection(db, 'stories');
          const q = query(
            storiesRef,
            where('uid', '==', user.uid),
            where('status', 'in', ['draft', 'saved', 'completed']),
            orderBy('updated_at', 'desc'),
            limit(1),
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          if (snap.empty) {
            setInitialState(null);
            setStoryLoading(false);
            return;
          }
          storyId = snap.docs[0].id;
        }

        if (cancelled) return;

        const state = await loadStoryById(storyId);
        if (cancelled) return;
        setInitialState(state);
      } catch (err) {
        console.error('Failed to load active story:', err);
        if (!cancelled) setInitialState(null);
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    }

    loadActiveStory();
    return () => { cancelled = true; };
  }, [user, urlStoryId]);

  const clearState = useCallback(() => setInitialState(null), []);

  return { initialState, storyLoading, clearState };
}
