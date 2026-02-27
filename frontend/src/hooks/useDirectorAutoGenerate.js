import { useEffect } from 'react';

export default function useDirectorAutoGenerate(directorAutoGenerate, send, setDirectorAutoGenerate, generating, currentArtStyle) {
  useEffect(() => {
    if (!directorAutoGenerate) return;
    // Don't fire if already generating — would be rejected by backend anyway
    if (generating) return;
    const timer = setTimeout(() => {
      // Use current dropdown art style (not backend's stale art_style_current)
      send(directorAutoGenerate.prompt, {
        artStyle: currentArtStyle || directorAutoGenerate.artStyle,
        sceneCount: directorAutoGenerate.sceneCount,
        language: directorAutoGenerate.language,
        fromDirector: true,
      });
      setDirectorAutoGenerate(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [directorAutoGenerate, send, setDirectorAutoGenerate, generating, currentArtStyle]);
}
