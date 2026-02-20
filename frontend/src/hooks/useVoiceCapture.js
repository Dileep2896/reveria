import { useRef, useState, useCallback } from 'react';

const MIN_RECORDING_MS = 600; // Minimum hold duration to send audio

export default function useVoiceCapture({ onAudioCaptured }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const abortedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, []);

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

        // Discard audio that's too short — likely accidental tap
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
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Collect data every 250ms for reliable chunks
      startTimeRef.current = Date.now();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      cleanup();
    }
  }, [onAudioCaptured, cleanup]);

  const stopRecording = useCallback(() => {
    // If startRecording is still awaiting getUserMedia, set abort flag
    abortedRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      // Recorder might not have started yet — clean up just in case
      cleanup();
    }
  }, [cleanup]);

  return { recording, startRecording, stopRecording };
}
