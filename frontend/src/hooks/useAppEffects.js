import { useEffect, useRef } from 'react';
import { db, getDoc, doc, updateDoc } from '../firebase';
import { API_URL, findFallbackCover } from '../utils/storyHelpers';

export default function useAppEffects({
  storyId, urlStoryId, isLibrary, isExplore, navigate,
  scenes, generating, initialState, idToken,
  bookMeta, setBookmarkedSceneIndex, resetSaved,
  setStoryStatus, setIsPublished, setArtStyle, setLanguage,
  setViewingReadOnly, setLiveHandler, setStoryDeletedHandler,
  clearState, reset, addToast, live,
  directorData, ambient,
  location,
}) {
  // Sync storyId → URL (skip for /book/ pages, library, explore)
  const isBookPage = location.pathname.startsWith('/book/');
  useEffect(() => {
    if (!storyId || isLibrary || isExplore || isBookPage) return;
    if (urlStoryId === storyId) return;
    navigate(`/story/${storyId}`, { replace: true });
  }, [storyId, urlStoryId, isLibrary, isExplore, isBookPage, navigate]);

  // Reset "Saved!" when new generation starts
  useEffect(() => {
    if (generating) resetSaved();
  }, [generating, resetSaved]);

  // Persist bookMeta to Firestore as soon as it arrives from WS
  useEffect(() => {
    if (!bookMeta || !storyId) return;
    const storyRef = doc(db, 'stories', storyId);
    getDoc(storyRef).then((snap) => {
      if (snap.exists() && snap.data().title_generated) return;
      updateDoc(storyRef, {
        title: bookMeta.title || 'Untitled Story',
        cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
        title_generated: true,
        updated_at: new Date(),
      }).catch((err) => console.error('Failed to persist bookMeta:', err));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookMeta, storyId]);

  // Fetch bookmark for current story
  useEffect(() => {
    if (!storyId || !idToken) {
      setBookmarkedSceneIndex(null);
      return;
    }
    fetch(`${API_URL}/api/stories/${storyId}/bookmark`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.scene_index != null) {
          setBookmarkedSceneIndex(data.scene_index);
        } else {
          setBookmarkedSceneIndex(null);
        }
      })
      .catch(() => setBookmarkedSceneIndex(null));
  }, [storyId, idToken, setBookmarkedSceneIndex]);

  // Clear read-only mode when navigating away from story view
  useEffect(() => {
    if (location.pathname !== '/' && !location.pathname.startsWith('/story/')) setViewingReadOnly(false);
  }, [location.pathname, setViewingReadOnly]);

  // Sync storyStatus + artStyle from loaded initial state
  useEffect(() => {
    if (initialState === null || initialState === undefined) {
      setStoryStatus(null);
      setIsPublished(false);
    } else if (initialState) {
      setStoryStatus(initialState.status || 'draft');
      setIsPublished(initialState.is_public || false);
      if (initialState.art_style) setArtStyle(initialState.art_style);
      if (initialState.language) setLanguage(initialState.language);
    }
  }, [initialState, setStoryStatus, setIsPublished, setArtStyle, setLanguage]);

  // Register live voice message handler
  useEffect(() => {
    setLiveHandler(live.handleMessage);
  }, [setLiveHandler, live.handleMessage]);

  // Handle backend deleting the entire story (all scenes removed)
  useEffect(() => {
    setStoryDeletedHandler(() => {
      clearState();
      setStoryStatus(null);
      setIsPublished(false);
      setArtStyle('cinematic');
      setLanguage('English');
      setBookmarkedSceneIndex(null);
      navigate('/');
      addToast('Story deleted — all scenes were removed', 'info');
    });
  }, [setStoryDeletedHandler, clearState, navigate, addToast, setStoryStatus, setIsPublished, setLanguage, setArtStyle, setBookmarkedSceneIndex]);

  // Crossfade ambient music when director mood changes
  const lastAmbientMood = useRef(null);
  useEffect(() => {
    const mood = directorData?.visual_style?.mood;
    if (mood && mood !== lastAmbientMood.current) {
      lastAmbientMood.current = mood;
      ambient.crossfadeTo(mood);
    }
  }, [directorData, ambient]);
}
