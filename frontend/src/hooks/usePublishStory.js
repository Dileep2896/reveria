import { useState, useCallback, useRef } from 'react';
import { db, getDoc, doc, updateDoc } from '../firebase';
import { API_URL, findFallbackCover } from '../utils/storyHelpers';

export default function usePublishStory({
  storyId,
  scenes,
  generations,
  bookMeta,
  idToken,
  addToast,
  user,
  getValidToken,
  generateBookMeta,
  setStoryStatus,
}) {
  const storyIdRef = useRef(storyId);
  storyIdRef.current = storyId;

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleComplete = useCallback(async () => {
    if (!storyId || completing) return;
    const capturedStoryId = storyId;
    setCompleting(true);
    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      const alreadyGenerated = snap.exists() && snap.data().title_generated;

      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'completed', updated_at: new Date() });
        if (storyIdRef.current === capturedStoryId) setStoryStatus('completed');
        setShowCompleteDialog(false);
        addToast('Book completed!', 'success');
        return;
      }

      if (bookMeta) {
        await updateDoc(storyRef, {
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          status: 'completed',
          updated_at: new Date(),
        });
        if (storyIdRef.current === capturedStoryId) setStoryStatus('completed');
        setShowCompleteDialog(false);
        addToast('Book completed!', 'success');
        return;
      }

      let title = (generations[0]?.prompt || 'Untitled Story').slice(0, 60);
      let coverUrl = findFallbackCover(scenes);

      addToast('Generating AI title & cover...', 'info');
      const sceneTexts = scenes.map((s) => s.text).filter(Boolean);
      const artStyle = scenes[0]?.art_style || 'cinematic';
      const meta = await generateBookMeta(sceneTexts, artStyle, capturedStoryId);
      if (meta) {
        title = meta.title || title;
        coverUrl = meta.cover_image_url || coverUrl;
      }

      if (storyIdRef.current !== capturedStoryId) return;

      await updateDoc(storyRef, {
        title,
        cover_image_url: coverUrl,
        title_generated: true,
        status: 'completed',
        updated_at: new Date(),
      });
      setStoryStatus('completed');
      setShowCompleteDialog(false);
      addToast('Book completed!', 'success');
    } catch (err) {
      console.error('Failed to complete book:', err);
      addToast('Failed to complete book', 'error');
    } finally {
      setCompleting(false);
    }
  }, [storyId, completing, scenes, generations, bookMeta, generateBookMeta, addToast, setStoryStatus]);

  const handlePublish = useCallback(async () => {
    if (!storyId || publishing) return;
    setPublishing(true);
    try {
      const token = getValidToken ? await getValidToken() : idToken;
      const res = await fetch(`${API_URL}/api/stories/${storyId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          author_name: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
          author_photo_url: user?.photoURL || null,
        }),
      });
      if (res.status === 429) {
        addToast('Publish limit reached - upgrade to Pro for unlimited publishing', 'error');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setIsPublished(true);
      setShowPublishDialog(false);
      addToast('Story published to Explore!', 'success');
    } catch (err) {
      console.error('Failed to publish:', err);
      addToast('Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  }, [storyId, publishing, user, idToken, getValidToken, addToast]);

  return {
    showCompleteDialog,
    setShowCompleteDialog,
    completing,
    isPublished,
    setIsPublished,
    showPublishDialog,
    setShowPublishDialog,
    publishing,
    handleComplete,
    handlePublish,
  };
}
