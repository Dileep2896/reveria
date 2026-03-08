import { useState, useRef, useEffect, useCallback } from 'react';

export default function useDirectorAudioPlayback(liveNotes, chatActive) {
  const [playingNoteIdx, setPlayingNoteIdx] = useState(null);
  const playedRef = useRef(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = useCallback((url, noteIdx) => {
    if (!url) return;
    if (playingNoteIdx === noteIdx && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingNoteIdx(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.onended = () => {
      setPlayingNoteIdx(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingNoteIdx(noteIdx);
  }, [playingNoteIdx]);

  useEffect(() => {
    if (!liveNotes.length) {
      playedRef.current = new Set();
      return;
    }
    if (chatActive) return;
    const latestIdx = liveNotes.length - 1;
    const latest = liveNotes[latestIdx];
    const key = `${latest.scene_number}`;
    if (latest.audio_url && !playedRef.current.has(key)) {
      playedRef.current.add(key);
      playAudio(latest.audio_url, latestIdx);
    }
  }, [liveNotes, playAudio, chatActive]);

  return { playingNoteIdx, playAudio };
}
