import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Continuous PCM audio capture for real-time streaming.
 * Sends raw 16kHz 16-bit mono PCM chunks via callback.
 * No client-side VAD — server handles endpointing.
 *
 * Can accept a pre-acquired MediaStream (from a user-gesture context)
 * to avoid getUserMedia permission issues in non-gesture contexts.
 */

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export default function usePCMCapture({ onPCMChunk, autoStart = false, externalStream = null }) {
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const freqDataRef = useRef(null);
  const onChunkRef = useRef(onPCMChunk);
  onChunkRef.current = onPCMChunk;

  const setupAudioPipeline = useCallback((stream) => {
    try {
      streamRef.current = stream;

      // Create AudioContext — prefer target rate, but browser may use native rate
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: TARGET_SAMPLE_RATE,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Analyser for amplitude visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      // ScriptProcessor for raw PCM capture
      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      const actualRate = audioCtx.sampleRate;
      const needsDownsample = Math.abs(actualRate - TARGET_SAMPLE_RATE) > 100;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);

        let samples = float32;
        if (needsDownsample) {
          const ratio = actualRate / TARGET_SAMPLE_RATE;
          const outLen = Math.floor(float32.length / ratio);
          const downsampled = new Float32Array(outLen);
          for (let i = 0; i < outLen; i++) {
            downsampled[i] = float32[Math.floor(i * ratio)];
          }
          samples = downsampled;
        }

        // Convert Float32 [-1, 1] to Int16 LE
        const int16 = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        onChunkRef.current?.(b64);
      };

      source.connect(processor);
      // ScriptProcessor requires connection to destination to fire events.
      // Route through zero-gain node to prevent mic audio playing through speakers.
      const muteNode = audioCtx.createGain();
      muteNode.gain.value = 0;
      processor.connect(muteNode);
      muteNode.connect(audioCtx.destination);

      setCapturing(true);
    } catch (err) {
      console.error('PCM pipeline setup failed:', err);
    }
  }, []);

  const startCapture = useCallback(async () => {
    // Already capturing
    if (processorRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setupAudioPipeline(stream);
    } catch (err) {
      console.error('PCM capture failed:', err);
    }
  }, [setupAudioPipeline]);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    freqDataRef.current = null;
    setCapturing(false);
  }, []);

  const getAmplitude = useCallback(() => {
    if (!analyserRef.current || !freqDataRef.current) return 0;
    analyserRef.current.getByteFrequencyData(freqDataRef.current);
    let sum = 0;
    for (let i = 0; i < freqDataRef.current.length; i++) sum += freqDataRef.current[i];
    return sum / (freqDataRef.current.length * 255);
  }, []);

  // Auto-start with external stream (pre-acquired from user gesture)
  useEffect(() => {
    if (externalStream && !processorRef.current) {
      setupAudioPipeline(externalStream);
    }
  }, [externalStream, setupAudioPipeline]);

  // Auto-start without external stream (fallback — may fail without user gesture)
  useEffect(() => {
    if (autoStart && !externalStream && !processorRef.current) {
      startCapture();
    }
  }, [autoStart, externalStream, startCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        processorRef.current.disconnect();
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return { capturing, startCapture, stopCapture, getAmplitude };
}
