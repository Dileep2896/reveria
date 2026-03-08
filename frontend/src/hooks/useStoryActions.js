import useGenerateBookMeta from './useGenerateBookMeta';
import useSaveStory from './useSaveStory';
import usePublishStory from './usePublishStory';

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
  const generateBookMeta = useGenerateBookMeta({ idToken, getValidToken });

  const {
    saving,
    saved,
    generatingCover,
    storyStatus,
    setStoryStatus,
    autoSaveCurrent,
    handleSave,
    resetSaved,
  } = useSaveStory({
    storyId,
    scenes,
    generations,
    bookMeta,
    addToast,
    generateBookMeta,
  });

  const {
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
  } = usePublishStory({
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
  });

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
