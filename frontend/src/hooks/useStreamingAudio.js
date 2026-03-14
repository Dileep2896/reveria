import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioScheduler, DEFAULT_GRACE_MS } from './audioScheduler';

const SA_DEBUG = true;
const saLog = (...args) => SA_DEBUG && console.log('%c[StreamAudio]', 'color: #45b7d1; font-weight: bold', ...args);

/**
 * Hook for gapless PCM audio playback from base64-encoded chunks.
 * Delegates scheduling logic to AudioScheduler (pure, testable).
 */
export default function useStreamingAudio({ onPlaybackStart, onPlaybackEnd } = {}) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const onStartRef = useRef(onPlaybackStart);
  const onEndRef = useRef(onPlaybackEnd);
  onStartRef.current = onPlaybackStart;
  onEndRef.current = onPlaybackEnd;

  // Scheduler manages timeline + active-source counting + grace period
  const schedulerRef = useRef(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new AudioScheduler({
      graceMs: DEFAULT_GRACE_MS,
      onStart: () => {
        saLog('▶️ Playback STARTED');
        setPlaying(true);
        onStartRef.current?.();
      },
      onEnd: () => {
        saLog('⏹️ Playback ENDED');
        setPlaying(false);
        onEndRef.current?.();
      },
    });
  }

  // Lazily create AudioContext + AnalyserNode
  const getCtx = useCallback(() => {
    if (ctxRef.current && ctxRef.current.state === 'closed') {
      ctxRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    }
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
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const feedChunk = useCallback((b64data) => {
    const ctx = getCtx();
    const analyser = analyserRef.current;
    const scheduler = schedulerRef.current;

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

    const { startAt } = scheduler.scheduleChunk(ctx.currentTime, buffer.duration);

    source.onended = () => {
      scheduler.onSourceEnded();
    };

    source.start(startAt);
  }, [getCtx]);

  const stop = useCallback(() => {
    saLog(`🛑 stop() called`);
    schedulerRef.current.stop();
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    schedulerRef.current.reset();
  }, []);

  const getAmplitude = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !schedulerRef.current.playing) return 0;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
    return (sum / dataArrayRef.current.length) / 255;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      schedulerRef.current?.stop();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  return { playing, feedChunk, stop, reset, getAmplitude };
}
