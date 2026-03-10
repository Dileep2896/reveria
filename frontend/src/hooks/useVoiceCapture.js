import { useRef, useState, useCallback, useEffect } from 'react';

const MIN_RECORDING_MS = 600; // Minimum hold duration to send audio

// VAD (Voice Activity Detection) constants
const SILENCE_THRESHOLD = 0.01; // RMS level below which = silence
const SILENCE_DURATION_MS = 800; // Auto-stop after 0.8s of silence
const VAD_POLL_INTERVAL_MS = 100; // Check audio level every 100ms

export default function useVoiceCapture({ onAudioCaptured, onVoiceStart }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const abortedRef = useRef(false);

  // VAD refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const speechDetectedRef = useRef(false);
  const silenceStartRef = useRef(null);
  const freqDataRef = useRef(null);

  const cleanupVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    speechDetectedRef.current = false;
    silenceStartRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    cleanupVAD();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, [cleanupVAD]);

  const startRecording = useCallback(async () => {
    // Reset abort flag
    abortedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // If stopRecording was called while we awaited getUserMedia, abort
      if (abortedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const elapsed = Date.now() - startTimeRef.current;

        // Discard audio that's too short - likely accidental tap
        if (elapsed < MIN_RECORDING_MS) {
          cleanup();
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Discard very small blobs (< 1KB = essentially silence)
        if (blob.size < 1000) {
          cleanup();
          return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          if (base64 && onAudioCaptured) {
            onAudioCaptured(base64, mimeType);
          }
        };
        reader.readAsDataURL(blob);

        // Cleanup tracks
        cleanupVAD();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Collect data every 250ms for reliable chunks
      startTimeRef.current = Date.now();
      setRecording(true);

      // Set up VAD: Web Audio AnalyserNode for silence detection
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioCtx = audioContextRef.current;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;
        freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);

        speechDetectedRef.current = false;
        silenceStartRef.current = null;

        const dataArray = new Float32Array(analyser.fftSize);

        vadIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(dataArray);

          // Compute RMS
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);

          if (rms > SILENCE_THRESHOLD) {
            // Speech detected — notify on first detection (barge-in signal)
            if (!speechDetectedRef.current && onVoiceStart) {
              onVoiceStart();
            }
            speechDetectedRef.current = true;
            silenceStartRef.current = null;
          } else if (speechDetectedRef.current) {
            // Silence after speech
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
              // 1.2s of silence after speech — auto-stop
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setRecording(false);
              }
            }
          }
        }, VAD_POLL_INTERVAL_MS);
      } catch (vadErr) {
        // VAD is best-effort — if AudioContext fails, manual stop still works
        console.warn('VAD setup failed, manual stop still available:', vadErr);
      }
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      cleanup();
    }
  }, [onAudioCaptured, onVoiceStart, cleanup, cleanupVAD]);

  const stopRecording = useCallback(() => {
    // If startRecording is still awaiting getUserMedia, set abort flag
    abortedRef.current = true;

    // Clear VAD immediately on manual stop
    cleanupVAD();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      // Recorder might not have started yet - clean up just in case
      cleanup();
    }
  }, [cleanup, cleanupVAD]);

  // Abort recording WITHOUT sending audio (discard captured data)
  const abortRecording = useCallback(() => {
    abortedRef.current = true;
    cleanupVAD();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Detach handlers so onstop doesn't fire onAudioCaptured
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    // Full cleanup: release mic tracks, clear chunks, set recording=false
    cleanup();
  }, [cleanup, cleanupVAD]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  /** Get current mic amplitude (0-1) for visualization. */
  const getAmplitude = useCallback(() => {
    if (!analyserRef.current || !freqDataRef.current) return 0;
    analyserRef.current.getByteFrequencyData(freqDataRef.current);
    let sum = 0;
    const arr = freqDataRef.current;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / (arr.length * 255);
  }, []);

  return { recording, startRecording, stopRecording, abortRecording, getAmplitude };
}
