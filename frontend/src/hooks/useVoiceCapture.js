import { useRef, useState, useCallback, useEffect } from 'react';

const VC_DEBUG = true;
const vcLog = (...args) => VC_DEBUG && console.log('%c[VoiceCapture]', 'color: #4ecdc4; font-weight: bold', ...args);
const vcWarn = (...args) => VC_DEBUG && console.warn('%c[VoiceCapture]', 'color: #ff6b6b; font-weight: bold', ...args);

// ── Streaming architecture ──
// Following Google's reference implementation (live-api-web-console):
// NO client-side VAD. Stream raw PCM chunks to backend → Gemini server-side VAD.
// Gemini's server VAD (startOfSpeechSensitivity: HIGH, endOfSpeechSensitivity: LOW)
// handles all speech boundary detection.
const CHUNK_INTERVAL_MS = 100;         // Send audio chunks every 100ms
const IDLE_TIMEOUT_MS = 20000;         // 20s no interaction → idle callback
const MAX_STREAM_DURATION_MS = 60000;  // 60s hard cap on streaming

// PCM conversion: AudioWorklet sends Float32 samples, we convert to Int16 PCM
// Gemini expects: PCM 16-bit, 16kHz, mono

/**
 * Audio processing worklet that captures raw PCM samples and sends them
 * to the main thread. Runs off the main thread for zero-latency capture.
 */
const WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._sampleCount = 0;
    // Send chunks roughly every 100ms (at 16kHz = 1600 samples, at 48kHz = 4800)
    this._chunkSamples = 4800;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i]);
    }
    this._sampleCount += samples.length;
    if (this._sampleCount >= this._chunkSamples) {
      this.port.postMessage({ type: 'audio', samples: new Float32Array(this._buffer) });
      this._buffer = [];
      this._sampleCount = 0;
    }
    return true;
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

export default function useVoiceCapture({ onAudioChunk, onStreamStart, onStreamEnd, onIdleTimeout }) {
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const workletNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const freqDataRef = useRef(null);
  const abortedRef = useRef(false);
  const startTimeRef = useRef(0);
  const idleTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const workletRegistered = useRef(false);

  const getStream = useCallback(async () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') return streamRef.current;
      streamRef.current = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    vcLog('🎙️ New mic stream acquired');
    return stream;
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  }, []);

  // Convert Float32 samples to Int16 PCM bytes (what Gemini expects)
  const float32ToInt16 = useCallback((float32Array) => {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return new Uint8Array(int16.buffer);
  }, []);

  // Convert Uint8Array to base64
  const uint8ToBase64 = useCallback((uint8Array) => {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }, []);

  const startRecording = useCallback(async () => {
    abortedRef.current = false;

    try {
      const stream = await getStream();
      if (abortedRef.current) return;

      // Setup AudioContext and worklet
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // Register worklet (once)
      if (!workletRegistered.current) {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await audioCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        workletRegistered.current = true;
        vcLog('🔧 AudioWorklet registered');
      }

      // Create source → worklet → analyser chain
      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      source.connect(worklet);
      source.connect(analyser);

      sourceNodeRef.current = source;
      workletNodeRef.current = worklet;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Handle audio chunks from worklet
      worklet.port.onmessage = (e) => {
        if (e.data.type === 'audio' && !abortedRef.current) {
          const pcmBytes = float32ToInt16(e.data.samples);
          const b64 = uint8ToBase64(pcmBytes);
          onAudioChunk?.(b64);
        }
      };

      startTimeRef.current = Date.now();
      setStreaming(true);
      onStreamStart?.();
      vcLog('🎤 Streaming STARTED (server-side VAD)');

      // Idle timeout
      idleTimerRef.current = setTimeout(() => {
        vcLog(`⏰ Idle timeout (${IDLE_TIMEOUT_MS / 1000}s)`);
        onIdleTimeout?.();
      }, IDLE_TIMEOUT_MS);

      // Max duration cap
      maxTimerRef.current = setTimeout(() => {
        vcLog('⏱️ Max stream duration — stopping');
        stopRecording();
      }, MAX_STREAM_DURATION_MS);

    } catch (err) {
      vcWarn('🚫 Microphone error:', err);
      setStreaming(false);
    }
  }, [getStream, onAudioChunk, onStreamStart, onIdleTimeout, float32ToInt16, uint8ToBase64]);

  const stopRecording = useCallback(() => {
    vcLog('⏹️ Streaming STOPPED');
    abortedRef.current = true;
    cleanup();
    setStreaming(false);
    onStreamEnd?.();
  }, [cleanup, onStreamEnd]);

  const abortRecording = useCallback(() => {
    vcLog('🚫 Streaming ABORTED');
    abortedRef.current = true;
    cleanup();
    setStreaming(false);
  }, [cleanup]);

  // Reset idle timer when called (e.g., when user speaks and Gemini confirms speech)
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        vcLog(`⏰ Idle timeout (${IDLE_TIMEOUT_MS / 1000}s)`);
        onIdleTimeout?.();
      }, IDLE_TIMEOUT_MS);
    }
  }, [onIdleTimeout]);

  useEffect(() => {
    return () => {
      cleanup();
      releaseStream();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [cleanup, releaseStream]);

  // Amplitude getter for orb visualization (kept from original — uses AnalyserNode)
  const getAmplitude = useCallback(() => {
    if (!analyserRef.current || !freqDataRef.current) return 0;
    analyserRef.current.getByteFrequencyData(freqDataRef.current);
    let sum = 0;
    const arr = freqDataRef.current;
    if (arr.length === 0) return 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / (arr.length * 255);
  }, []);

  // Backward compat: expose `recording` as alias for `streaming`
  return {
    recording: streaming,
    streaming,
    startRecording,
    stopRecording,
    abortRecording,
    resetIdleTimer,
    getAmplitude,
    releaseStream,
  };
}
