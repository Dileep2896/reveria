import { useState, useCallback, useRef } from 'react';
import { db, getDoc, doc, updateDoc } from '../firebase';
import { findFallbackCover } from '../utils/storyHelpers';

export default function useSaveStory({
  storyId,
  scenes,
  generations,
  bookMeta,
  addToast,
  generateBookMeta,
}) {
  const storyIdRef = useRef(storyId);
  storyIdRef.current = storyId;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [storyStatus, setStoryStatus] = useState(null);
  const saveLockRef = useRef(false);

  const autoSaveCurrent = useCallback(async () => {
    if (!storyId || scenes.length === 0 || storyStatus === 'completed') return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      const snap = await getDoc(storyRef);
      if (!snap.exists()) return;
      const dbData = snap.data();
      if (dbData.status === 'completed') return;
      const alreadyGenerated = dbData.title_generated;

      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        return;
      }

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

      await updateDoc(storyRef, {
        status: 'saved',
        updated_at: new Date(),
      });
    } catch (err) {
      console.error('Failed to auto-save story:', err);
    }
  }, [storyId, scenes, generations, storyStatus, bookMeta]);

  const handleSave = useCallback(async () => {
    if (!storyId || saving || generatingCover || storyStatus === 'completed' || saveLockRef.current) return;
    saveLockRef.current = true;
    const capturedStoryId = storyId;

    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      if (!snap.exists()) return;
      const dbData = snap.data();
      if (dbData.status === 'completed') {
        setStoryStatus('completed');
        return;
      }
      const alreadyGenerated = dbData.title_generated;

      if (alreadyGenerated) {
        setSaving(true);
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        setStoryStatus('saved');
        setSaved(true);
        addToast('Story saved!', 'success');
        setTimeout(() => setSaved(false), 3000);
        return;
      }

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
      saveLockRef.current = false;
    }
  }, [storyId, saving, generatingCover, storyStatus, generations, scenes, bookMeta, generateBookMeta, addToast]);

  const resetSaved = useCallback(() => setSaved(false), []);

  return {
    saving,
    saved,
    generatingCover,
    storyStatus,
    setStoryStatus,
    autoSaveCurrent,
    handleSave,
    resetSaved,
  };
}
