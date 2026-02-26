import { useState, useEffect } from 'react';
import { API_URL } from '../utils/storyHelpers';

export default function usePublicStory(authLoading, user, urlStoryId) {
  const [publicStory, setPublicStory] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user && urlStoryId && !publicStory && !publicLoading) {
      setPublicLoading(true);
      fetch(`${API_URL}/api/public/stories/${urlStoryId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPublicStory(data); })
        .catch(() => {})
        .finally(() => setPublicLoading(false));
    }
  }, [authLoading, user, urlStoryId, publicStory, publicLoading]);

  return { publicStory, publicLoading };
}
