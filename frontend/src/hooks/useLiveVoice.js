import { useRef, useState, useCallback, useEffect } from 'react';

export default function useLiveVoice(wsRef) {
  const [isLive, setIsLive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [readyPrompt, setReadyPrompt] = useState(null);
  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);

  const startLive = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setTranscript([]);
    setReadyPrompt(null);
    wsRef.current.send(JSON.stringify({ type: 'live_start' }));
  }, [wsRef]);

  const stopLive = useCallback(() => {
    // Stop audio capture
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'live_stop' }));
    }
    setIsLive(false);
  }, [wsRef]);

  const sendText = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isLive) {
      setTranscript(prev => [...prev, { role: 'user', text }]);
      wsRef.current.send(JSON.stringify({ type: 'live_text', text }));
    }
  }, [wsRef, isLive]);

  // Start audio streaming when session is confirmed
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // Use ScriptProcessor to get raw PCM chunks
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16 PCM
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
        }
        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        wsRef.current.send(JSON.stringify({
          type: 'live_audio_chunk',
          audio_data: b64,
          mime_type: 'audio/pcm;rate=16000',
        }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('Failed to start audio capture:', err);
    }
  }, [wsRef]);

  // Handle incoming live messages
  const handleMessage = useCallback((data) => {
    if (data.type === 'live_started') {
      setIsLive(true);
      startAudioCapture();
      return true;
    }
    if (data.type === 'live_response') {
      setTranscript(prev => [...prev, { role: 'assistant', text: data.text }]);
      return true;
    }
    if (data.type === 'live_prompt_ready') {
      setReadyPrompt(data.prompt);
      setTranscript(prev => [...prev, { role: 'system', text: `Story prompt ready: ${data.prompt}` }]);
      return true;
    }
    if (data.type === 'live_turn_complete') {
      return true;
    }
    if (data.type === 'live_stopped') {
      setIsLive(false);
      return true;
    }
    if (data.type === 'live_error') {
      setTranscript(prev => [...prev, { role: 'system', text: `Error: ${data.error}` }]);
      return true;
    }
    return false;
  }, [startAudioCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isLive,
    transcript,
    readyPrompt,
    startLive,
    stopLive,
    sendText,
    handleMessage,
    clearPrompt: useCallback(() => setReadyPrompt(null), []),
  };
}
