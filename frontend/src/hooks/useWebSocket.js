import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export default function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);
  const disposed = useRef(false);

  const [connected, setConnected] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [userPrompt, setUserPrompt] = useState(null);
  const [error, setError] = useState(null);
  const [directorData, setDirectorData] = useState(null);

  // Generation batch tracking: each batch = { prompt, directorData, sceneNumbers }
  const generationsRef = useRef([]);
  const currentBatchIndexRef = useRef(-1);
  const [generations, setGenerations] = useState([]);

  const connect = useCallback(() => {
    if (disposed.current) return;
    clearTimeout(reconnectTimer.current);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore events from stale sockets
      if (wsRef.current !== ws) return;
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;
    };

    ws.onclose = () => {
      // Ignore events from stale sockets (replaced or disposed)
      if (wsRef.current !== ws) return;
      setConnected(false);
      setGenerating(false);
      // Auto-reconnect with exponential backoff
      if (!disposed.current) {
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn('WebSocket: malformed message', event.data);
        return;
      }

      if (data.type === 'status') {
        setGenerating(data.content === 'generating');
        if (data.content === 'generating') {
          setError(null);
        }
        return;
      }

      if (data.type === 'text') {
        const currentBatch = generationsRef.current[currentBatchIndexRef.current];
        setScenes((prev) => [
          ...prev,
          {
            scene_number: data.scene_number,
            text: data.content,
            image_url: null,
            prompt: currentBatch?.prompt || null,
          },
        ]);
        if (currentBatch) {
          currentBatch.sceneNumbers.push(data.scene_number);
          setGenerations([...generationsRef.current]);
        }
        return;
      }

      if (data.type === 'image') {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? { ...scene, image_url: data.content }
              : scene,
          ),
        );
        return;
      }

      if (data.type === 'audio') {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? { ...scene, audio_url: data.content }
              : scene,
          ),
        );
        return;
      }

      if (data.type === 'image_error') {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? { ...scene, image_url: 'error' }
              : scene,
          ),
        );
        return;
      }

      if (data.type === 'director') {
        setDirectorData(data.content);
        const currentBatch = generationsRef.current[currentBatchIndexRef.current];
        if (currentBatch) {
          currentBatch.directorData = data.content;
          setGenerations([...generationsRef.current]);
        }
        return;
      }

      if (data.type === 'transcription') {
        setUserPrompt(data.content);
        // Create batch for voice input
        generationsRef.current.push({ prompt: data.content, directorData: null, sceneNumbers: [] });
        currentBatchIndexRef.current = generationsRef.current.length - 1;
        setGenerations([...generationsRef.current]);
        return;
      }

      if (data.type === 'error') {
        setError(data.content);
        return;
      }
    };
  }, []);

  // Initial connection + cleanup
  useEffect(() => {
    disposed.current = false;
    connect();
    return () => {
      disposed.current = true;
      clearTimeout(reconnectTimer.current);
      // Close current socket; the stale-check in onclose prevents reconnect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((content, options = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setUserPrompt(content);
      setError(null);
      // Create new generation batch
      generationsRef.current.push({ prompt: content, directorData: null, sceneNumbers: [] });
      currentBatchIndexRef.current = generationsRef.current.length - 1;
      setGenerations([...generationsRef.current]);
      wsRef.current.send(JSON.stringify({
        content,
        art_style: options.artStyle || 'cinematic',
        scene_count: options.sceneCount || 2,
      }));
    }
  }, []);

  const sendAudio = useCallback((audioBase64, mimeType) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'voice_input',
        audio_data: audioBase64,
        mime_type: mimeType,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setScenes([]);
    setUserPrompt(null);
    setError(null);
    setGenerating(false);
    setDirectorData(null);
    generationsRef.current = [];
    currentBatchIndexRef.current = -1;
    setGenerations([]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  return { connected, scenes, generating, userPrompt, error, directorData, generations, send, sendAudio, reset };
}
