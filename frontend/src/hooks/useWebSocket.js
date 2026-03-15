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
  const [generating, _setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const setGenerating = useCallback((v) => {
    const val = typeof v === 'function' ? v(generatingRef.current) : v;
    generatingRef.current = val;
    _setGenerating(val);
  }, []);
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
  const [directorLiveNotes, setDirectorLiveNotes] = useState([]);
  const [directorChatActive, setDirectorChatActive] = useState(false);
  const [directorChatMessages, setDirectorChatMessages] = useState([]);
  const [directorChatLoading, setDirectorChatLoading] = useState(false);
  const [directorChatPrompt, setDirectorChatPrompt] = useState(null);
  const [directorAutoGenerate, setDirectorAutoGenerate] = useState(null);
  const [heroMode, setHeroMode] = useState({ active: false, description: '' });
  const [generationStage, setGenerationStage] = useState(null);
  const storyDeletedRef = useRef(null);
  const controlBarInputRef = useRef(null);
  const languageDetectedRef = useRef(null);
  const navigateRef = useRef(null);
  const audioChunkRef = useRef(null);
  const audioDoneRef = useRef(null);
  const artStyleRef = useRef(null);

  const idTokenRef = useRef(idToken);
  const prevTokenRef = useRef(idToken);
  const authFailedRef = useRef(false);
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
      storyDeletedRef, setControlBarInput: (v) => controlBarInputRef.current?.(v),
      setUsage,
      setDirectorLiveNotes,
      setDirectorChatActive, setDirectorChatMessages, setDirectorChatLoading, setDirectorChatPrompt,
      setDirectorAutoGenerate,
      setHeroMode,
      setGenerationStage,
      onLanguageDetected: (lang) => languageDetectedRef.current?.(lang),
      onNavigate: (dest) => navigateRef.current?.(dest),
      onAudioChunk: (data) => audioChunkRef.current?.(data),
      onAudioDone: (data) => audioDoneRef.current?.(data),
      onArtStyleChange: (style) => artStyleRef.current?.(style),
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
      // Hydrate Director live notes and batch-level director data from persisted generations
      if (initialState.generations?.length) {
        const allNotes = initialState.generations.flatMap(g => g.directorLiveNotes || []);
        if (allNotes.length) setDirectorLiveNotes(allNotes);
        // Use the latest generation's directorData (it already covers all scenes)
        let mergedData = null;
        for (const g of initialState.generations) {
          if (g.directorData) mergedData = g.directorData;
        }
        if (mergedData) setDirectorData(mergedData);
      }
    }
  }, [initialState]);

  const connect = useCallback(() => {
    const token = idTokenRef.current;
    if (disposed.current || !token) return;
    clearTimeout(reconnectTimer.current);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      // First-message auth: send token before any other messages
      ws.send(JSON.stringify({ type: 'auth', token }));
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;

      const sid = storyIdRef.current || initialStateRef.current?.storyId;
      if (sid) {
        ws.send(JSON.stringify({ type: 'resume', story_id: sid }));
      }
    };

    ws.onclose = (e) => {
      if (wsRef.current !== ws) return;
      setConnected(false);
      setGenerating(false);
      setSceneBusy(new Set());
      setDirectorChatLoading(false);
      setDirectorChatActive(false);
      setDirectorChatMessages([]);
      setDirectorChatPrompt(null);
      setDirectorAutoGenerate(null);
      if (!disposed.current) {
        // Auth failure (4003) — wait for token refresh from AuthContext, don't spam reconnect
        if (e.code === 4003) {
          authFailedRef.current = true;
          return;
        }
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
        // Jitter: ±20% to prevent thundering herd on backend restart
        const jitter = delay * (0.8 + Math.random() * 0.4);
        reconnectTimer.current = setTimeout(connect, jitter);
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
  }, [setGenerating]);

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

  // Reconnect with fresh token after auth failure or periodic token refresh
  useEffect(() => {
    if (!idToken || !storyResolved) return;
    const tokenChanged = prevTokenRef.current && prevTokenRef.current !== idToken;
    prevTokenRef.current = idToken;
    if (tokenChanged && authFailedRef.current) {
      // Token was refreshed after an auth failure — reconnect
      authFailedRef.current = false;
      reconnectDelay.current = RECONNECT_BASE_MS;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      connect();
    }
  }, [idToken, storyResolved, connect]);

  const send = useCallback((content, options = {}) => {
    if (generatingRef.current) return; // prevent duplicate generation
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setUserPrompt(content);
      setError(null);
      quotaImageToastFired.current = false;
      generationsRef.current.push({ prompt: content, directorData: null, sceneNumbers: [] });
      currentBatchIndexRef.current = generationsRef.current.length - 1;
      setGenerations([...generationsRef.current]);
      const msg = {
        content,
        art_style: options.artStyle || 'cinematic',
        scene_count: options.sceneCount || 1,
        language: options.language || 'English',
        template: options.template || 'storybook',
      };
      if (options.fromDirector) {
        msg.from_director = true;
      }
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendSteer = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'steer', content: text }));
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

  const sendHeroPhoto = useCallback((photoData, mimeType, heroName) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = { type: 'hero_photo', photo_data: photoData, mime_type: mimeType };
      if (heroName) msg.hero_name = heroName;
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendHeroName = useCallback((name) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'hero_name', name }));
    }
  }, []);

  const sendSceneAction = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const startDirectorChat = useCallback((storyContext, { language, voiceName, template, demoMode } = {}) => {
    console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', `🎬 Starting Director Chat (lang=${language}, voice=${voiceName}, template=${template}, demo=${!!demoMode})`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setDirectorChatActive(true);
      setDirectorChatLoading(true);
      setDirectorChatMessages([]);
      setDirectorChatPrompt(null);
      const msg = { type: 'director_chat_start', story_context: storyContext || '' };
      if (language) msg.language = language;
      if (voiceName) msg.voice_name = voiceName;
      if (template) msg.template = template;
      if (demoMode) msg.demo_mode = true;
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('%c[WS-Send]', 'color: #fd79a8; font-weight: bold', `🚫 Can't start chat — WS state=${wsRef.current?.readyState}`);
    }
  }, []);

  // Legacy blob-based audio send (kept for backward compat / text-to-speech fallback)
  const sendDirectorChatAudio = useCallback((base64, mimeType) => {
    if (generatingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', `🎤 Sending audio blob (${(base64.length / 1024).toFixed(1)}KB)`);
      setDirectorChatLoading(true);
      const id = `user-${Date.now()}`;
      setDirectorChatMessages(prev => [...prev, { id, role: 'user', type: 'audio', content: 'Voice message' }]);
      wsRef.current.send(JSON.stringify({ type: 'director_chat_audio', audio_data: base64, mime_type: mimeType }));
    }
  }, []);

  // Streaming audio: send PCM chunks continuously (server-side VAD)
  const sendDirectorAudioChunk = useCallback((b64chunk) => {
    if (generatingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'director_chat_audio_chunk', data: b64chunk }));
    }
  }, []);

  // Signal that mic streaming has started (so backend can prepare for chunks)
  const sendDirectorAudioStreamStart = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', '🎤 Audio stream START');
      const id = `user-${Date.now()}`;
      setDirectorChatMessages(prev => [...prev, { id, role: 'user', type: 'audio', content: 'Voice message' }]);
      wsRef.current.send(JSON.stringify({ type: 'director_chat_audio_stream_start' }));
    }
  }, []);

  // Signal that mic streaming has ended (user stopped / muted)
  const sendDirectorAudioStreamEnd = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', '🎤 Audio stream END');
      setDirectorChatLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'director_chat_audio_stream_end' }));
    }
  }, []);

  // Send silent text to Director (used for nudges — no message shown in chat)
  const sendDirectorChatText = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', '📝 Nudge:', text?.slice(0, 60));
      setDirectorChatLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'director_chat_text', content: text }));
    }
  }, []);

  const suggestDirectorPrompt = useCallback((storyContext) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setDirectorChatLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'director_chat_suggest', story_context: storyContext || '' }));
    }
  }, []);

  const cancelDirectorAutoGenerate = useCallback(() => {
    setDirectorAutoGenerate(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'director_chat_cancel_generate' }));
    }
  }, []);

  const endDirectorChat = useCallback(() => {
    console.log('%c[WS-Send]', 'color: #a29bfe; font-weight: bold', '🔴 Ending Director Chat');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'director_chat_end' }));
    }
    setDirectorChatActive(false);
    setDirectorChatMessages([]);
    setDirectorChatLoading(false);
    setDirectorChatPrompt(null);
    addToastRef.current?.('Director mode ended', 'info');
  }, []);

  const reset = useCallback(() => {
    clearInterval(cooldownTimer.current);
    setQuotaCooldown(0);
    setScenes([]);
    setUserPrompt(null);
    setError(null);
    setGenerating(false);
    setDirectorData(null);
    setBookMeta(null);
    setPortraits([]);
    setPortraitsLoading(false);
    setUsage(null);
    setDirectorLiveNotes([]);
    setDirectorChatActive(false);
    setDirectorChatMessages([]);
    setDirectorChatLoading(false);
    setDirectorChatPrompt(null);
    setDirectorAutoGenerate(null);
    setHeroMode({ active: false, description: '' });
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
  }, [setGenerating]);

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
    // Hydrate Director live notes and batch-level director data from persisted generations
    const allNotes = (state.generations || []).flatMap(g => g.directorLiveNotes || []);
    setDirectorLiveNotes(allNotes);
    // Use the latest generation's directorData (it already covers all scenes)
    const gens = state.generations || [];
    let mergedDirData = null;
    for (const g of gens) {
      if (g.directorData) mergedDirData = g.directorData;
    }
    if (mergedDirData) setDirectorData(mergedDirData);
    if (!skipResume && wsRef.current?.readyState === WebSocket.OPEN && state.storyId) {
      wsRef.current.send(JSON.stringify({ type: 'resume', story_id: state.storyId }));
    }
  }, []);

  const setStoryDeletedHandler = useCallback((handler) => { storyDeletedRef.current = handler; }, []);
  const setControlBarInputHandler = useCallback((handler) => { controlBarInputRef.current = handler; }, []);
  const setLanguageDetectedHandler = useCallback((handler) => { languageDetectedRef.current = handler; }, []);
  const setNavigateHandler = useCallback((handler) => { navigateRef.current = handler; }, []);
  const setAudioChunkHandler = useCallback((handler) => { audioChunkRef.current = handler; }, []);
  const setAudioDoneHandler = useCallback((handler) => { audioDoneRef.current = handler; }, []);
  const setArtStyleHandler = useCallback((handler) => { artStyleRef.current = handler; }, []);

  return { connected, scenes, generating, generationStage, userPrompt, error, directorData, directorLiveNotes, generations, storyId, quotaCooldown, sceneBusy, bookMeta, portraits, portraitsLoading, usage, heroMode, send, sendSteer, sendAudio, sendHeroPhoto, sendHeroName, sendSceneAction, reset, load, setStoryDeletedHandler, setControlBarInputHandler, setLanguageDetectedHandler, setNavigateHandler, setAudioChunkHandler, setAudioDoneHandler, setArtStyleHandler, directorChatActive, directorChatMessages, directorChatLoading, directorChatPrompt, directorAutoGenerate, setDirectorAutoGenerate, cancelDirectorAutoGenerate, startDirectorChat, sendDirectorChatAudio, sendDirectorAudioChunk, sendDirectorAudioStreamStart, sendDirectorAudioStreamEnd, sendDirectorChatText, suggestDirectorPrompt, endDirectorChat };
}
