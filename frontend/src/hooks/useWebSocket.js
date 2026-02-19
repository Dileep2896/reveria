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
        setScenes((prev) => [
          ...prev,
          {
            scene_number: data.scene_number,
            text: data.content,
            image_url: null,
          },
        ]);
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
      wsRef.current.send(JSON.stringify({
        content,
        art_style: options.artStyle || 'cinematic',
        scene_count: options.sceneCount || 2,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setScenes([]);
    setUserPrompt(null);
    setError(null);
    setGenerating(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  return { connected, scenes, generating, userPrompt, error, send, reset };
}
