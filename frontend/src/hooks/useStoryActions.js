import { useState, useCallback, useRef } from 'react';
import { db, getDoc, doc, updateDoc } from '../firebase';
import { API_URL, findFallbackCover } from '../utils/storyHelpers';

export default function useStoryActions({
  storyId,
  scenes,
  generations,
  bookMeta,
  idToken,
  addToast,
  user,
  getValidToken,
}) {
  const storyIdRef = useRef(storyId);
  storyIdRef.current = storyId;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [storyStatus, setStoryStatus] = useState(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Reset "Saved!" when new generation starts
  // (caller passes `generating` changes via resetSaved)

  // Generate AI book title + cover via backend
  const generateBookMeta = useCallback(async (sceneTexts, artStyle, sid) => {
    try {
      const token = getValidToken ? await getValidToken() : idToken;
      const res = await fetch(`${API_URL}/api/generate-book-meta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scene_texts: sceneTexts,
          art_style: artStyle,
          story_id: sid,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('Book meta generation failed:', err);
      return null;
    }
  }, [idToken, getValidToken]);

  // Auto-save current story as 'saved' (used when switching away from a draft)
  // NEVER calls generateBookMeta - always fast (~200ms)
  const autoSaveCurrent = useCallback(async () => {
    if (!storyId || scenes.length === 0 || storyStatus === 'completed') return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      const snap = await getDoc(storyRef);
      if (!snap.exists()) return;
      const dbData = snap.data();
      // Never regress a completed story back to saved
      if (dbData.status === 'completed') return;
      const alreadyGenerated = dbData.title_generated;

      // Tier 1: already has AI title + cover
      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        return;
      }

      // Tier 2: bookMeta arrived from WebSocket background task
      if (bookMeta) {
        await updateDoc(storyRef, {
          status: 'saved',
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          updated_at: new Date(),
        });
        return;
      }

      // Tier 3: save status only — don't write title/cover to avoid racing
      // with auto_generate_meta background task. title_generated stays false
      // so the background task or explicit Save can set the AI title later.
      await updateDoc(storyRef, {
        status: 'saved',
        updated_at: new Date(),
      });
    } catch (err) {
      console.error('Failed to auto-save story:', err);
    }
  }, [storyId, scenes, generations, storyStatus, bookMeta]);

  const handleSave = useCallback(async () => {
    if (!storyId || saving || generatingCover || storyStatus === 'completed') return;
    const capturedStoryId = storyId;

    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      if (!snap.exists()) return;
      const dbData = snap.data();
      // Never regress a completed story back to saved
      if (dbData.status === 'completed') {
        setStoryStatus('completed');
        return;
      }
      const alreadyGenerated = dbData.title_generated;

      // Tier 1: already has AI title + cover - just update status (instant)
      if (alreadyGenerated) {
        setSaving(true);
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        setStoryStatus('saved');
        setSaved(true);
        addToast('Story saved!', 'success');
        setTimeout(() => setSaved(false), 3000);
        return;
      }

      // Tier 2: bookMeta available from WS - write it + set flag (instant)
      if (bookMeta) {
        setSaving(true);
        await updateDoc(storyRef, {
          status: 'saved',
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          updated_at: new Date(),
        });
        setStoryStatus('saved');
        setSaved(true);
        addToast('Story saved!', 'success');
        setTimeout(() => setSaved(false), 3000);
        return;
      }

      // Tier 3: call API with spinner → write result + set flag
      let title = (generations[0]?.prompt || 'Untitled Story').slice(0, 60);
      let coverUrl = findFallbackCover(scenes);

      setGeneratingCover(true);
      addToast('Generating AI title & cover...', 'info');
      const sceneTexts = scenes.map((s) => s.text).filter(Boolean);
      const artStyle = scenes[0]?.art_style || 'cinematic';
      const meta = await generateBookMeta(sceneTexts, artStyle, capturedStoryId);
      setGeneratingCover(false);
      if (meta) {
        title = meta.title || title;
        coverUrl = meta.cover_image_url || coverUrl;
        if (!meta.cover_image_url && meta.title) {
          addToast('Cover generation blocked - using scene image', 'warning');
        }
      }

      // Guard: user may have navigated away during async cover generation
      if (storyIdRef.current !== capturedStoryId) return;

      setSaving(true);
      await updateDoc(storyRef, {
        status: 'saved',
        title,
        cover_image_url: coverUrl,
        title_generated: true,
        updated_at: new Date(),
      });
      setStoryStatus('saved');
      setSaved(true);
      addToast('Story saved!', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save story:', err);
      addToast('Failed to save story', 'error');
      setGeneratingCover(false);
    } finally {
      setSaving(false);
    }
  }, [storyId, saving, generatingCover, storyStatus, generations, scenes, bookMeta, generateBookMeta, addToast]);

  const handleComplete = useCallback(async () => {
    if (!storyId || completing) return;
    const capturedStoryId = storyId;
    setCompleting(true);
    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      const alreadyGenerated = snap.exists() && snap.data().title_generated;

      // Tier 1: already has AI title + cover - just complete
      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'completed', updated_at: new Date() });
        if (storyIdRef.current === capturedStoryId) setStoryStatus('completed');
        setShowCompleteDialog(false);
        addToast('Book completed!', 'success');
        return;
      }

      // Tier 2: bookMeta available from WS - write it + complete
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

      // Tier 3: call API → write result + complete
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

      // Guard: user may have navigated away during async cover generation
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
  }, [storyId, completing, scenes, generations, bookMeta, generateBookMeta, addToast]);

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

  // Convenience: reset saved flag (called by parent when generating changes)
  const resetSaved = useCallback(() => setSaved(false), []);

  return {
    saving,
    saved,
    generatingCover,
    storyStatus,
    setStoryStatus,
    showCompleteDialog,
    setShowCompleteDialog,
    completing,
    isPublished,
    setIsPublished,
    showPublishDialog,
    setShowPublishDialog,
    publishing,
    autoSaveCurrent,
    handleSave,
    handleComplete,
    handlePublish,
    generateBookMeta,
    resetSaved,
  };
}
