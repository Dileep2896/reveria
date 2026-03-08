import { useCallback } from 'react';
import { API_URL } from '../utils/storyHelpers';

export default function useGenerateBookMeta({ idToken, getValidToken }) {
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

  return generateBookMeta;
}
