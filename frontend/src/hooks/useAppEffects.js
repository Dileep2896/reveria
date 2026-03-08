import { useEffect, useRef } from 'react';
import { ROUTES } from '../routes';
import { db, getDoc, doc, updateDoc } from '../firebase';
import { API_URL, findFallbackCover } from '../utils/storyHelpers';

export default function useAppEffects({
  storyId, urlStoryId, isLibrary, isExplore, navigate,
  scenes, generating, initialState, idToken,
  bookMeta, setBookmarkedSceneIndex, resetSaved,
  setStoryStatus, setIsPublished, setArtStyle, setLanguage, setTemplate,
  setViewingReadOnly, setStoryDeletedHandler,
  clearState, addToast,
  location,
}) {
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;

  // Sync storyId → URL (skip for /book/ pages, library, explore, subscription, admin)
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const isBookPage = pathname.startsWith(ROUTES.BOOK_PREFIX);
  const isSubscription = pathname === ROUTES.SUBSCRIPTION;
  const isAdminPage = pathname === ROUTES.ADMIN;
  const isTermsPage = pathname === ROUTES.TERMS;
  useEffect(() => {
    if (!storyId || isLibrary || isExplore || isBookPage || isSubscription || isAdminPage || isTermsPage) return;
    if (urlStoryId === storyId) return;
    navigate(ROUTES.STORY(storyId), { replace: true });
  }, [storyId, urlStoryId, isLibrary, isExplore, isBookPage, isSubscription, isAdminPage, isTermsPage, navigate]);

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
        cover_image_url: bookMeta.coverUrl || findFallbackCover(scenesRef.current),
        title_generated: true,
        updated_at: new Date(),
      }).catch((err) => console.error('Failed to persist bookMeta:', err));
    });
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
    if (pathname !== ROUTES.HOME && !pathname.startsWith(ROUTES.STORY_PREFIX)) setViewingReadOnly(false);
  }, [pathname, setViewingReadOnly]);

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
      if (initialState.template) setTemplate(initialState.template);
    }
  }, [initialState, setStoryStatus, setIsPublished, setArtStyle, setLanguage, setTemplate]);

  // Handle backend deleting the entire story (all scenes removed)
  useEffect(() => {
    setStoryDeletedHandler(() => {
      clearState();
      setStoryStatus(null);
      setIsPublished(false);
      setArtStyle('cinematic');
      setTemplate('storybook');
      setLanguage('English');
      setBookmarkedSceneIndex(null);
      navigate(ROUTES.HOME);
      addToast('Story deleted - all scenes were removed', 'info');
    });
  }, [setStoryDeletedHandler, clearState, navigate, addToast, setStoryStatus, setIsPublished, setLanguage, setArtStyle, setTemplate, setBookmarkedSceneIndex]);
}
