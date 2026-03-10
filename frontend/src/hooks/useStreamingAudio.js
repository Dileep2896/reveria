import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook for gapless PCM audio playback from base64-encoded chunks.
 * Schedules AudioBufferSourceNodes back-to-back on a Web Audio timeline.
 */
export default function useStreamingAudio({ onPlaybackStart, onPlaybackEnd } = {}) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef(null);
  const nextTimeRef = useRef(0);
  const activeCountRef = useRef(0);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const playingRef = useRef(false);
  const onStartRef = useRef(onPlaybackStart);
  const onEndRef = useRef(onPlaybackEnd);
  onStartRef.current = onPlaybackStart;
  onEndRef.current = onPlaybackEnd;

  // Lazily create AudioContext + AnalyserNode
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const feedChunk = useCallback((b64data) => {
    const ctx = getCtx();
    const analyser = analyserRef.current;

    // Decode base64 to PCM 16-bit LE
    const raw = atob(b64data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);

    // Schedule gapless playback
    const now = ctx.currentTime;
    const startAt = Math.max(now, nextTimeRef.current);
    nextTimeRef.current = startAt + buffer.duration;

    activeCountRef.current++;
    if (!playingRef.current) {
      playingRef.current = true;
      setPlaying(true);
      onStartRef.current?.();
    }

    source.onended = () => {
      activeCountRef.current--;
      if (activeCountRef.current <= 0) {
        activeCountRef.current = 0;
        playingRef.current = false;
        setPlaying(false);
        onEndRef.current?.();
      }
    };

    source.start(startAt);
  }, [getCtx]);

  const stop = useCallback(() => {
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
    }
    activeCountRef.current = 0;
    nextTimeRef.current = 0;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      onEndRef.current?.();
    }
  }, []);

  const reset = useCallback(() => {
    // Reset scheduling timeline for new response (don't close context)
    nextTimeRef.current = 0;
  }, []);

  const getAmplitude = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !playingRef.current) return 0;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
    return (sum / dataArrayRef.current.length) / 255;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  return { playing, feedChunk, stop, reset, getAmplitude };
}
