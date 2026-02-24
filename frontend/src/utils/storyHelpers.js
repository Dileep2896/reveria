import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
} from '../firebase';

export const API_URL = (() => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
})();

export async function loadStoryById(storyId) {
  const storyDoc = await getDoc(doc(db, 'stories', storyId));
  const storyData = storyDoc.exists() ? storyDoc.data() : {};

  const scenesSnap = await getDocs(collection(db, 'stories', storyId, 'scenes'));
  const scenes = scenesSnap.docs
    .map((d) => d.data())
    .sort((a, b) => a.scene_number - b.scene_number);

  const gensSnap = await getDocs(collection(db, 'stories', storyId, 'generations'));
  const generations = gensSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        prompt: data.prompt,
        directorData: data.director_data || null,
        directorLiveNotes: data.director_live_notes || [],
        sceneNumbers: data.scene_numbers || [],
      };
    })
    .sort((a, b) => {
      const aFirst = a.sceneNumbers[0] ?? 0;
      const bFirst = b.sceneNumbers[0] ?? 0;
      return aFirst - bFirst;
    });

  return { storyId, scenes, generations, status: storyData.status || 'draft', is_public: storyData.is_public || false, art_style: storyData.art_style || 'cinematic', language: storyData.language || 'English', portraits: storyData.portraits || [] };
}

export function findFallbackCover(scenes) {
  return scenes.find(
    (s) => s.image_url && s.image_url !== 'error' && !s.image_url.startsWith('data:')
  )?.image_url || null;
}
