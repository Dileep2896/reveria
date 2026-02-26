import { useCallback } from 'react';
import { ROUTES } from '../routes';
import { db, doc, updateDoc } from '../firebase';

export default function useBookManager({
  storyId,
  autoSaveCurrent,
  reset,
  load,
  navigate,
  user,
  setStoryStatus,
  setIsPublished,
  setArtStyle,
  setLanguage,
  setViewingReadOnly,
}) {
  const handleOpenBook = useCallback(async (bookData) => {
    setViewingReadOnly(false);
    if (bookData.storyId !== storyId) {
      await autoSaveCurrent();
      reset();
    }

    // Touch updated_at so this book becomes the most recent for auto-resume
    try {
      await updateDoc(doc(db, 'stories', bookData.storyId), {
        updated_at: new Date(),
      });
    } catch (err) {
      console.error('Failed to set draft status:', err);
    }

    const isCompleted = bookData.status === 'completed';
    setStoryStatus(bookData.status || 'draft');
    setIsPublished(bookData.is_public || false);
    if (bookData.art_style) setArtStyle(bookData.art_style);
    setLanguage(bookData.language || 'English');

    setTimeout(() => {
      load(bookData, { skipResume: isCompleted });
      navigate(ROUTES.STORY(bookData.storyId));
    }, 50);
  }, [storyId, autoSaveCurrent, reset, load, navigate, setViewingReadOnly, setStoryStatus, setIsPublished, setArtStyle, setLanguage]);

  const handleOpenPublicBook = useCallback((bookData) => {
    const isOwn = bookData.authorUid === user?.uid;
    if (!isOwn) {
      reset();
      setViewingReadOnly(true);
      setTimeout(() => {
        load(bookData, { skipResume: true });
        navigate(ROUTES.STORY(bookData.storyId));
      }, 50);
    } else if (bookData.status === 'completed') {
      // Own completed book - view only, no WS resume
      reset();
      setStoryStatus('completed');
      setIsPublished(bookData.is_public || false);
      setTimeout(() => {
        load(bookData, { skipResume: true });
        navigate(ROUTES.STORY(bookData.storyId));
      }, 50);
    } else {
      handleOpenBook(bookData);
    }
  }, [user, reset, load, navigate, handleOpenBook, setViewingReadOnly, setStoryStatus, setIsPublished]);

  return { handleOpenBook, handleOpenPublicBook };
}
