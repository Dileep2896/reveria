import { useState, useEffect, useRef } from 'react';

/* ── Custom hook for audio playback (only-one-at-a-time logic) ── */
export default function useCompactAudio(src) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const playingRef = useRef(false);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onError = () => {
      console.warn('Audio load error:', audio.error?.message, 'src:', audio.src?.slice(0, 80));
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  useEffect(() => {
    const onOtherPlay = (e) => {
      if (e.detail !== instanceId.current && playingRef.current) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener('storyforge:audio:play', onOtherPlay);
    return () => {
      window.removeEventListener('storyforge:audio:play', onOtherPlay);
      // Pause audio on unmount to prevent orphaned playback
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent('storyforge:audio:play', { detail: instanceId.current }));
      audio.play().catch((err) => {
        console.warn('Audio playback failed:', err?.message, 'src:', audio.src?.slice(0, 80));
        setPlaying(false);
      });
      setPlaying(true);
    }
  };

  return { audioRef, playing, progress, togglePlay };
}
