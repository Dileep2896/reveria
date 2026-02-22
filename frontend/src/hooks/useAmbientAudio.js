import { useRef, useState, useCallback, useEffect } from 'react';

const MOOD_MAP = {
  // Map director mood keywords to ambient track filenames
  peaceful: 'peaceful',
  serene: 'peaceful',
  calm: 'peaceful',
  gentle: 'peaceful',
  mysterious: 'mysterious',
  suspenseful: 'mysterious',
  eerie: 'mysterious',
  tense: 'tense',
  anxious: 'tense',
  urgent: 'tense',
  chaotic: 'chaotic',
  frantic: 'chaotic',
  intense: 'chaotic',
  melancholic: 'melancholic',
  sad: 'melancholic',
  somber: 'melancholic',
  nostalgic: 'melancholic',
  joyful: 'joyful',
  happy: 'joyful',
  playful: 'joyful',
  whimsical: 'joyful',
  epic: 'epic',
  dramatic: 'epic',
  heroic: 'epic',
  triumphant: 'epic',
};

const AMBIENT_VOLUME = 0.15;
const FADE_OUT_MS = 1000;
const FADE_IN_MS = 2000;

export default function useAmbientAudio() {
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferCache = useRef({});
  const currentMood = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.gain.value = 0;
      gainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const loadBuffer = useCallback(async (track) => {
    if (bufferCache.current[track]) return bufferCache.current[track];
    const ctx = getContext();
    try {
      const res = await fetch(`/ambient/${track}.mp3`);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      bufferCache.current[track] = audioBuf;
      return audioBuf;
    } catch {
      return null;
    }
  }, [getContext]);

  const crossfadeTo = useCallback(async (mood) => {
    if (!mood) return;
    const track = MOOD_MAP[mood.toLowerCase()] || 'peaceful';
    if (track === currentMood.current) return;
    currentMood.current = track;

    const ctx = getContext();
    const gain = gainRef.current;

    // Fade out current
    if (sourceRef.current) {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT_MS / 1000);
      const oldSource = sourceRef.current;
      setTimeout(() => { try { oldSource.stop(); } catch {} }, FADE_OUT_MS);
      sourceRef.current = null;
    }

    const buffer = await loadBuffer(track);
    if (!buffer) return;

    // Wait for fade out
    await new Promise(r => setTimeout(r, FADE_OUT_MS));

    // Don't play if mood changed during load
    if (currentMood.current !== track) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    sourceRef.current = source;

    const targetVol = mutedRef.current ? 0 : AMBIENT_VOLUME;
    gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + FADE_IN_MS / 1000);
    setPlaying(true);
  }, [getContext, loadBuffer]);

  const toggle = useCallback(() => {
    const ctx = getContext();
    const gain = gainRef.current;
    if (!gain) return;
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setMuted(newMuted);
    gain.gain.linearRampToValueAtTime(
      newMuted ? 0 : AMBIENT_VOLUME,
      ctx.currentTime + 0.5,
    );
  }, [getContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); } catch {}
      try { ctxRef.current?.close(); } catch {}
    };
  }, []);

  return { crossfadeTo, toggle, playing, muted };
}
