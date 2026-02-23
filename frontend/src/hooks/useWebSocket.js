import { useEffect, useRef, useState, useCallback } from 'react';
import { createWsHandlers } from './wsHandlers';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export default function useWebSocket(idToken, initialState, addToast) {
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
  const [storyId, setStoryId] = useState(initialState?.storyId || null);
  const storyIdRef = useRef(initialState?.storyId || null);
  const [quotaCooldown, setQuotaCooldown] = useState(0);
  const cooldownTimer = useRef(null);
  const [sceneBusy, setSceneBusy] = useState(new Set());
  const [bookMeta, setBookMeta] = useState(null);
  const [portraits, setPortraits] = useState([]);
  const [portraitsLoading, setPortraitsLoading] = useState(false);
  const [usage, setUsage] = useState(null);

  const liveHandlerRef = useRef(null);
  const storyDeletedRef = useRef(null);
  const controlBarInputRef = useRef(null);

  const idTokenRef = useRef(idToken);
  idTokenRef.current = idToken;

  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const quotaImageToastFired = useRef(false);

  const generationsRef = useRef([]);
  const currentBatchIndexRef = useRef(-1);
  const [generations, setGenerations] = useState([]);

  const initialStateRef = useRef(initialState);
  const hydratedRef = useRef(false);

  const storyResolved = initialState !== undefined;

  // Build message handler (stable - all refs)
  const handleMessage = useRef(null);
  if (!handleMessage.current) {
    handleMessage.current = createWsHandlers({
      setScenes, setGenerating, setUserPrompt, setError, setDirectorData,
      setStoryId, storyIdRef, setQuotaCooldown, setSceneBusy, setBookMeta,
      setPortraits, setPortraitsLoading, setGenerations,
      generationsRef, currentBatchIndexRef, initialStateRef, hydratedRef,
      addToastRef, quotaImageToastFired, cooldownTimer,
      liveHandlerRef, storyDeletedRef, setControlBarInput: (v) => controlBarInputRef.current?.(v),
      setUsage,
    });
  }

  // Hydrate from initialState
  useEffect(() => {
    if (initialState && !hydratedRef.current) {
      hydratedRef.current = true;
      initialStateRef.current = initialState;

      if (initialState.storyId) {
        setStoryId(initialState.storyId);
        storyIdRef.current = initialState.storyId;
      }
      if (initialState.scenes?.length) {
        setScenes(initialState.scenes.map(s => ({ ...s, _preloaded: true })));
      }
      if (initialState.generations?.length) {
        generationsRef.current = initialState.generations;
        currentBatchIndexRef.current = initialState.generations.length - 1;
        setGenerations([...initialState.generations]);
      }
      if (initialState.portraits?.length) {
        setPortraits(initialState.portraits);
      }
    }
  }, [initialState]);

  const connect = useCallback(() => {
    const token = idTokenRef.current;
    if (disposed.current || !token) return;
    clearTimeout(reconnectTimer.current);

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;

      const sid = storyIdRef.current || initialStateRef.current?.storyId;
      if (sid) {
        ws.send(JSON.stringify({ type: 'resume', story_id: sid }));
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setConnected(false);
      setGenerating(false);
      if (!disposed.current) {
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn('WebSocket: malformed message', event.data);
        return;
      }

      handleMessage.current(data);
    };
  }, []);

  // Connect when idToken is available AND story state is resolved
  useEffect(() => {
    disposed.current = false;
    if (idToken && storyResolved) {
      connect();
    }
    return () => {
      disposed.current = true;
      clearTimeout(reconnectTimer.current);
      clearInterval(cooldownTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [idToken, storyResolved, connect]);

  const send = useCallback((content, options = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setUserPrompt(content);
      setError(null);
      quotaImageToastFired.current = false;
      generationsRef.current.push({ prompt: content, directorData: null, sceneNumbers: [] });
      currentBatchIndexRef.current = generationsRef.current.length - 1;
      setGenerations([...generationsRef.current]);
      wsRef.current.send(JSON.stringify({
        content,
        art_style: options.artStyle || 'cinematic',
        scene_count: options.sceneCount || 2,
        language: options.language || 'English',
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

  const sendSceneAction = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const reset = useCallback(() => {
    setScenes([]);
    setUserPrompt(null);
    setError(null);
    setGenerating(false);
    setDirectorData(null);
    setBookMeta(null);
    setPortraits([]);
    setPortraitsLoading(false);
    setUsage(null);
    quotaImageToastFired.current = false;
    setStoryId(null);
    storyIdRef.current = null;
    generationsRef.current = [];
    currentBatchIndexRef.current = -1;
    setGenerations([]);
    initialStateRef.current = null;
    hydratedRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  const load = useCallback((state, { skipResume = false } = {}) => {
    hydratedRef.current = true;
    initialStateRef.current = state;
    setBookMeta(null);
    setStoryId(state.storyId || null);
    storyIdRef.current = state.storyId || null;
    setScenes(state.scenes?.length ? state.scenes.map(s => ({ ...s, _preloaded: true })) : []);
    generationsRef.current = state.generations?.length ? state.generations : [];
    currentBatchIndexRef.current = state.generations?.length ? state.generations.length - 1 : -1;
    setGenerations(state.generations?.length ? [...state.generations] : []);
    setPortraits(state.portraits?.length ? state.portraits : []);
    if (!skipResume && wsRef.current?.readyState === WebSocket.OPEN && state.storyId) {
      wsRef.current.send(JSON.stringify({ type: 'resume', story_id: state.storyId }));
    }
  }, []);

  const setLiveHandler = useCallback((handler) => { liveHandlerRef.current = handler; }, []);
  const setStoryDeletedHandler = useCallback((handler) => { storyDeletedRef.current = handler; }, []);
  const setControlBarInputHandler = useCallback((handler) => { controlBarInputRef.current = handler; }, []);

  return { connected, scenes, generating, userPrompt, error, directorData, generations, storyId, quotaCooldown, sceneBusy, bookMeta, portraits, portraitsLoading, usage, send, sendAudio, sendSceneAction, reset, load, wsRef, setLiveHandler, setStoryDeletedHandler, setControlBarInputHandler };
}
