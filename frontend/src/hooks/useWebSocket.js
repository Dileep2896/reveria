import { useEffect, useRef, useState, useCallback } from 'react';

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

  // Live voice message handler ref (set by App via setLiveHandler)
  const liveHandlerRef = useRef(null);
  // Callback when backend deletes entire story (all scenes removed)
  const storyDeletedRef = useRef(null);

  // Ref for idToken so reconnects always use the latest token
  const idTokenRef = useRef(idToken);
  idTokenRef.current = idToken;

  // Toast callback ref (avoids stale closure in connect)
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const quotaImageToastFired = useRef(false);

  // Generation batch tracking: each batch = { prompt, directorData, sceneNumbers }
  const generationsRef = useRef([]);
  const currentBatchIndexRef = useRef(-1);
  const [generations, setGenerations] = useState([]);

  // Track initial state to send resume on open
  const initialStateRef = useRef(initialState);
  const hydratedRef = useRef(false);

  // Story loading resolved: undefined = still loading, null/object = done.
  // We gate WebSocket connection on this so onopen always has the correct storyId.
  const storyResolved = initialState !== undefined;

  // Hydrate from initialState on first mount (or when initialState changes)
  useEffect(() => {
    if (initialState && !hydratedRef.current) {
      hydratedRef.current = true;
      initialStateRef.current = initialState;

      if (initialState.storyId) {
        setStoryId(initialState.storyId);
        storyIdRef.current = initialState.storyId;
      }
      if (initialState.scenes?.length) {
        // Mark scenes as preloaded so SceneCard skips reveal animations
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
      // Ignore events from stale sockets
      if (wsRef.current !== ws) return;
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;

      // Send resume with current story (handles reconnects for newly generated stories too)
      const sid = storyIdRef.current || initialStateRef.current?.storyId;
      if (sid) {
        ws.send(JSON.stringify({ type: 'resume', story_id: sid }));
      }
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

      // Route live voice messages to handler
      if (data.type?.startsWith('live_') && liveHandlerRef.current) {
        if (liveHandlerRef.current(data)) return;
      }

      if (data.type === 'story_id') {
        setStoryId(data.content);
        storyIdRef.current = data.content;
        return;
      }

      if (data.type === 'book_meta') {
        setBookMeta({ title: data.title, coverUrl: data.cover_image_url });
        addToastRef.current?.('AI title & cover ready!', 'info');
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
        // In-place update for scene regen
        if (data.is_regen) {
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_number === data.scene_number
                ? { ...scene, text: data.content, image_url: null, audio_url: null, image_tier: null }
                : scene,
            ),
          );
          return;
        }
        const currentBatch = generationsRef.current[currentBatchIndexRef.current];
        setScenes((prev) => [
          ...prev,
          {
            scene_number: data.scene_number,
            text: data.content,
            scene_title: data.scene_title || null,
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
              ? { ...scene, image_url: data.content, image_tier: data.tier || 1 }
              : scene,
          ),
        );
        return;
      }

      if (data.type === 'audio') {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? {
                  ...scene,
                  audio_url: data.content,
                  ...(data.word_timestamps ? { word_timestamps: data.word_timestamps } : {}),
                }
              : scene,
          ),
        );
        return;
      }

      if (data.type === 'image_error') {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? { ...scene, image_url: 'error', image_error_reason: data.reason || 'generation_failed' }
              : scene,
          ),
        );
        if (data.reason === 'quota_exhausted' && !quotaImageToastFired.current) {
          quotaImageToastFired.current = true;
          addToastRef.current?.('Image skipped — quota exhausted', 'warning');
        }
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

      if (data.type === 'quota_exhausted') {
        const seconds = data.retry_after || 60;
        setQuotaCooldown(seconds);
        addToastRef.current?.(`Image quota exhausted — retry in ${seconds}s`, 'warning', 6000);
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = setInterval(() => {
          setQuotaCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownTimer.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return;
      }

      if (data.type === 'regen_start') {
        setSceneBusy((prev) => new Set(prev).add(data.scene_number));
        return;
      }

      if (data.type === 'regen_done' || data.type === 'regen_error') {
        setSceneBusy((prev) => {
          const next = new Set(prev);
          next.delete(data.scene_number);
          return next;
        });
        return;
      }

      if (data.type === 'scene_skipped') {
        // Image generation completely failed — remove the scene
        setScenes((prev) => prev.map((s) =>
          s.scene_number === data.scene_number ? { ...s, _deleting: true } : s
        ));
        setTimeout(() => {
          setScenes((prev) => prev.filter((s) => s.scene_number !== data.scene_number));
        }, 500);
        const reason = data.reason === 'quota_exhausted'
          ? 'Scene skipped — image quota exhausted'
          : 'Scene skipped — image generation failed';
        addToastRef.current?.(reason, 'warning');
        return;
      }

      if (data.type === 'scene_deleted') {
        // Mark as deleting for animation
        setScenes((prev) => prev.map((s) =>
          s.scene_number === data.scene_number ? { ...s, _deleting: true } : s
        ));
        // Remove after animation completes
        setTimeout(() => {
          setScenes((prev) => prev.filter((s) => s.scene_number !== data.scene_number));
        }, 500);
        setSceneBusy((prev) => {
          const next = new Set(prev);
          next.delete(data.scene_number);
          return next;
        });
        return;
      }

      if (data.type === 'story_deleted') {
        // Backend deleted the entire story (all scenes removed)
        setScenes([]);
        setUserPrompt(null);
        setError(null);
        setGenerating(false);
        setDirectorData(null);
        setBookMeta(null);
        setPortraits([]);
        setPortraitsLoading(false);
        setStoryId(null);
        storyIdRef.current = null;
        generationsRef.current = [];
        currentBatchIndexRef.current = -1;
        setGenerations([]);
        initialStateRef.current = null;
        hydratedRef.current = false;
        storyDeletedRef.current?.();
        return;
      }

      if (data.type === 'portrait') {
        setPortraits((prev) => {
          // Avoid duplicates (WS resume may resend portraits already loaded from Firestore)
          const exists = prev.some(p => p.name === data.name && p.image_url === data.image_url);
          if (exists) return prev;
          // Replace existing entry for same character (regeneration)
          const withoutOld = prev.filter(p => p.name !== data.name);
          return [...withoutOld, { name: data.name, image_url: data.image_url, error: data.error }];
        });
        return;
      }

      if (data.type === 'portraits_done') {
        setPortraitsLoading(false);
        return;
      }

      if (data.type === 'error') {
        setError(data.content);
        addToastRef.current?.(data.content, 'error');
        return;
      }
    };
  }, []);

  // Connect when idToken is available AND story state is resolved.
  // Waiting for storyResolved ensures that by the time onopen fires,
  // storyIdRef is set correctly and resume always works on first connect.
  // Reconnects bypass this gate (they call connect() directly from onclose).
  useEffect(() => {
    disposed.current = false;
    if (idToken && storyResolved) {
      connect();
    }
    return () => {
      disposed.current = true;
      clearTimeout(reconnectTimer.current);
      clearInterval(cooldownTimer.current);
      // Close current socket; the stale-check in onclose prevents reconnect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // connect is stable (no deps) — only re-run when idToken or storyResolved change
  }, [idToken, storyResolved, connect]);

  const send = useCallback((content, options = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setUserPrompt(content);
      setError(null);
      quotaImageToastFired.current = false;
      // Create new generation batch
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

  const sendPortraitRequest = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setPortraits([]);
      setPortraitsLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'generate_portraits' }));
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
    // Always set scenes/generations (clear if empty to avoid stale data)
    setScenes(state.scenes?.length ? state.scenes.map(s => ({ ...s, _preloaded: true })) : []);
    generationsRef.current = state.generations?.length ? state.generations : [];
    currentBatchIndexRef.current = state.generations?.length ? state.generations.length - 1 : -1;
    setGenerations(state.generations?.length ? [...state.generations] : []);
    // Restore portraits from Firestore (WS resume may also send them)
    setPortraits(state.portraits?.length ? state.portraits : []);
    // Skip resume for read-only viewing (other users' stories)
    if (!skipResume && wsRef.current?.readyState === WebSocket.OPEN && state.storyId) {
      wsRef.current.send(JSON.stringify({ type: 'resume', story_id: state.storyId }));
    }
  }, []);

  const setLiveHandler = useCallback((handler) => { liveHandlerRef.current = handler; }, []);
  const setStoryDeletedHandler = useCallback((handler) => { storyDeletedRef.current = handler; }, []);

  return { connected, scenes, generating, userPrompt, error, directorData, generations, storyId, quotaCooldown, sceneBusy, bookMeta, portraits, portraitsLoading, send, sendAudio, sendSceneAction, sendPortraitRequest, reset, load, wsRef, setLiveHandler, setStoryDeletedHandler };
}
