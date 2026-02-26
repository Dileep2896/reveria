import { useEffect } from 'react';

export default function useMoodTheming(directorLiveNotes) {
  useEffect(() => {
    if (!directorLiveNotes?.length) {
      document.documentElement.removeAttribute('data-mood');
      return;
    }
    const latestMood = directorLiveNotes[directorLiveNotes.length - 1]?.mood;
    if (latestMood) {
      document.documentElement.setAttribute('data-mood', latestMood);
    }
  }, [directorLiveNotes]);
}
