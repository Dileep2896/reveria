import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useVoiceCapture from '../hooks/useVoiceCapture';
import useStreamingAudio from '../hooks/useStreamingAudio';
import VoiceOrb from './VoiceOrb';
import Tooltip from './Tooltip';

export default function DirectorChat({
  onSendAudio,
  onEndChat,
  onSuggestPrompt,
  onUsePrompt,
  messages,
  suggestedPrompt,
  chatLoading,
  autoGenerate,
  onCancelAutoGenerate,
  generating,
  castAnalyzing = false,
  setAudioChunkHandler,
  setAudioDoneHandler,
}) {
  const [speaking, setSpeaking] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const audioRef = useRef(null);
  const playedIds = useRef(new Set());
  const prevSpeakingRef = useRef(false);
  const mountedRef = useRef(true);

  // Streaming audio for low-latency Director responses
  const streamingStartRecRef = useRef(null);
  const { playing: streamPlaying, feedChunk, stop: stopStreaming, reset: resetStreaming, getAmplitude: getStreamAmplitude } = useStreamingAudio({
    onPlaybackStart: () => {
      if (mountedRef.current) setSpeaking(true);
      // Hot mic during streaming playback for barge-in
      streamingStartRecRef.current?.();
    },
    onPlaybackEnd: () => {
      if (mountedRef.current) setSpeaking(false);
    },
  });

  // Register streaming handlers with WS layer
  const streamingActiveRef = useRef(false);
  useEffect(() => {
    if (setAudioChunkHandler) {
      setAudioChunkHandler((b64data) => {
        if (!streamingActiveRef.current) {
          // First chunk of new response — reset scheduling
          resetStreaming();
          streamingActiveRef.current = true;
        }
        feedChunk(b64data);
      });
    }
    if (setAudioDoneHandler) {
      setAudioDoneHandler((_data) => {
        streamingActiveRef.current = false;
        // Audio playback continues until all scheduled buffers finish
      });
    }
    return () => {
      if (setAudioChunkHandler) setAudioChunkHandler(null);
      if (setAudioDoneHandler) setAudioDoneHandler(null);
    };
  }, [setAudioChunkHandler, setAudioDoneHandler, feedChunk, resetStreaming]);

  // Countdown timer for auto-generate
  useEffect(() => {
    if (!autoGenerate) { setCountdown(5); setPromptExpanded(false); return; }
    setCountdown(5);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [autoGenerate]);

  const handleAudioCaptured = useCallback(
    (b64, mime) => onSendAudio?.(b64, mime),
    [onSendAudio],
  );

  // Barge-in: when user starts speaking, cut Director audio immediately
  const handleVoiceStart = useCallback(() => {
    // Stop streaming audio (PCM chunks)
    stopStreaming();
    // Stop legacy Audio element (greeting/tool call responses)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (mountedRef.current) setSpeaking(false);
  }, [stopStreaming]);

  const { recording, startRecording, stopRecording, abortRecording, getAmplitude: getMicAmplitude } = useVoiceCapture({
    onAudioCaptured: handleAudioCaptured,
    onVoiceStart: handleVoiceStart,
  });

  // Wire startRecording ref for streaming audio hot-mic
  useEffect(() => {
    streamingStartRecRef.current = (!generating && !castAnalyzing) ? startRecording : null;
  }, [generating, castAnalyzing, startRecording]);

  // Auto-play Director audio for legacy path (greeting / tool call responses)
  // Barge-in: start recording immediately so mic is hot during Director speech.
  // Echo cancellation filters speaker audio; if user actually speaks, VAD fires
  // onVoiceStart which cuts Director audio.
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (
      latest?.role === 'director' &&
      latest.audioUrl &&
      !playedIds.current.has(latest.id)
    ) {
      playedIds.current.add(latest.id);
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(latest.audioUrl);
      audio.volume = 0.7;
      let playStarted = false;
      audio.onplay = () => {
        playStarted = true;
        if (mountedRef.current) setSpeaking(true);
        // Start recording immediately for barge-in (mic hot during Director speech)
        if (mountedRef.current && !generating && !castAnalyzing) startRecording();
      };
      audio.onended = () => { if (mountedRef.current) setSpeaking(false); };
      audio.onerror = () => { if (mountedRef.current) setSpeaking(false); };
      audio.play().catch(() => { if (mountedRef.current) setSpeaking(false); });
      // Fallback: if audio doesn't fire onplay within 2s (autoplay blocked), auto-resume recording
      setTimeout(() => {
        if (!playStarted && mountedRef.current && !generating && !castAnalyzing) startRecording();
      }, 2000);
      audioRef.current = audio;
    }
  }, [messages, generating, castAnalyzing, startRecording]);

  // Auto-resume recording after Director finishes speaking (fallback if mic wasn't already hot)
  useEffect(() => {
    if (speaking) {
      prevSpeakingRef.current = true;
    } else if (prevSpeakingRef.current) {
      prevSpeakingRef.current = false;
      // Don't auto-resume during generation or cast photo upload flow
      if (generating || castAnalyzing) return;
      // Director just finished — if not already recording, start after brief pause
      const timer = setTimeout(() => {
        if (mountedRef.current && !recording) startRecording();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [speaking, recording, startRecording, generating, castAnalyzing]);

  // Abort recording (discard audio) when cast photo upload starts
  // Note: Director speaking no longer aborts — barge-in cuts Director audio instead
  useEffect(() => {
    if (castAnalyzing && recording) abortRecording();
  }, [castAnalyzing, recording, abortRecording]);

  // Auto-resume when generation ends
  const prevGenerating = useRef(false);
  useEffect(() => {
    if (prevGenerating.current && !generating && !speaking) {
      // Generation just finished — auto-resume after brief pause
      const timer = setTimeout(() => {
        if (mountedRef.current && !speaking) startRecording();
      }, 800);
      prevGenerating.current = false;
      return () => clearTimeout(timer);
    }
    prevGenerating.current = generating;
  }, [generating, speaking, startRecording]);

  // Auto-resume when cast upload flow ends
  const prevCastAnalyzing = useRef(false);
  useEffect(() => {
    if (prevCastAnalyzing.current && !castAnalyzing && !speaking && !generating) {
      // Cast flow just finished — auto-resume after brief pause
      const timer = setTimeout(() => {
        if (mountedRef.current && !speaking) startRecording();
      }, 800);
      prevCastAnalyzing.current = false;
      return () => clearTimeout(timer);
    }
    prevCastAnalyzing.current = castAnalyzing;
  }, [castAnalyzing, speaking, generating, startRecording]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStreaming();
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [stopStreaming]);

  // Unified amplitude getter — picks the right audio source
  const getOrbAmplitude = useCallback(() => {
    if (recording) return getMicAmplitude();
    if (streamPlaying) return getStreamAmplitude();
    // Legacy Audio element speaking — synthetic gentle pulse
    if (speaking) return 0.15 + Math.sin(Date.now() * 0.008) * 0.1;
    return 0;
  }, [recording, streamPlaying, speaking, getMicAmplitude, getStreamAmplitude]);

  // Show 'speaking' when Director audio is playing even if mic is hot (barge-in ready)
  const orbState = castAnalyzing
    ? 'waiting'
    : speaking
      ? 'speaking'
      : recording
        ? 'recording'
        : chatLoading
          ? 'loading'
          : generating
            ? 'watching'
            : 'idle';

  // Toggle: tap to start recording, tap again to send
  // Barge-in: tapping during 'speaking' starts recording (voice will cut Director audio via VAD)
  const handleOrbClick = () => {
    if (orbState === 'waiting') return; // blocked during cast upload
    if (recording) {
      stopRecording(); // sends audio automatically via onAudioCaptured
    } else if (orbState === 'idle' || orbState === 'speaking') {
      startRecording();
    }
    // Ignore clicks during loading
  };

  return (
    <div className="director-voice-section">
      {/* Voice Orb — canvas blob reacting to audio */}
      <button
        className={`director-voice-orb-btn ${orbState}`}
        onClick={handleOrbClick}
        aria-label={orbState === 'waiting' ? 'Analyzing hero photo' : recording ? 'Stop recording' : chatLoading ? 'Director is thinking' : speaking ? 'Tap to interrupt Director' : generating ? 'Director is watching' : 'Start recording'}
        type="button"
      >
        <VoiceOrb mode={orbState} getAmplitude={getOrbAmplitude} size={72} />
        {/* Overlay icon */}
        <div className="voice-orb-icon">
          {orbState === 'waiting' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ) : orbState === 'watching' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : orbState === 'loading' ? (
            <div className="voice-loading">
              {[0, 1, 2].map((i) => (
                <span key={i} className="voice-loading-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          ) : recording ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.8">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          )}
        </div>
      </button>

      {/* Status label */}
      <span
        className="voice-status-label"
        style={{
          color:
            orbState === 'waiting'
              ? 'var(--accent-secondary)'
              : orbState === 'recording'
                ? 'var(--status-error, #ef4444)'
                : orbState === 'speaking'
                  ? 'var(--accent-secondary)'
                  : orbState === 'watching'
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
        }}
      >
        {orbState === 'waiting'
          ? 'Analyzing hero photo...'
          : orbState === 'recording'
            ? 'Listening...'
            : orbState === 'speaking'
              ? 'Director speaking'
              : orbState === 'loading'
                ? 'Thinking...'
                : orbState === 'watching'
                  ? 'Watching story unfold...'
                  : 'Tap to speak'}
      </span>

      {/* Auto-generate countdown card */}
      {autoGenerate && (
        <div className="voice-autogen-card">
          <div className="voice-autogen-progress" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="voice-autogen-label">Generating in {countdown}s...</span>
          </div>
          <Tooltip label="Click to view full prompt">
          <p
            className="voice-autogen-prompt"
            onClick={() => setPromptExpanded(true)}
            style={{ cursor: 'pointer' }}
          >
            {autoGenerate.prompt}
          </p>
          </Tooltip>
          <button onClick={onCancelAutoGenerate} className="voice-autogen-cancel">
            Cancel
          </button>
        </div>
      )}

      {/* Prompt detail dialog */}
      {promptExpanded && autoGenerate && createPortal(
        <div
          className="prompt-dialog-overlay"
          onClick={() => setPromptExpanded(false)}
        >
          <div className="prompt-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)' }}>
                  Director's Prompt
                </span>
              </div>
              <button
                onClick={() => setPromptExpanded(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {autoGenerate.prompt}
            </p>
          </div>
        </div>,
        document.body,
      )}

      {/* Suggested prompt card */}
      {suggestedPrompt && !autoGenerate && (
        <div className="voice-suggestion-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-secondary)' }}>
              Suggested Prompt
            </span>
          </div>
          <p style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            {suggestedPrompt}
          </p>
          <button
            onClick={() => onUsePrompt?.(suggestedPrompt)}
            className="voice-use-prompt-btn"
          >
            Use as Prompt
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="voice-actions">
        <button
          onClick={onSuggestPrompt}
          disabled={chatLoading || recording}
          className="voice-action-btn voice-suggest-btn"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
          </svg>
          Suggest
        </button>
        <button
          onClick={() => {
            if (recording) stopRecording();
            stopStreaming();
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            onEndChat?.();
          }}
          className="voice-action-btn voice-end-btn"
        >
          End Chat
        </button>
      </div>

      {/* Powered by Gemini */}
      <div className="powered-by-gemini">
        <svg width="12" height="12" viewBox="0 0 28 28" fill="none">
          <defs>
            <linearGradient id="geminiGrad" x1="0" y1="0" x2="28" y2="28">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="33%" stopColor="#9B72CB" />
              <stop offset="66%" stopColor="#D96570" />
              <stop offset="100%" stopColor="#F49E42" />
            </linearGradient>
          </defs>
          <path d="M14 0C14 7.732 7.732 14 0 14c7.732 0 14 6.268 14 14 0-7.732 6.268-14 14-14C20.268 14 14 7.732 14 0z" fill="url(#geminiGrad)" />
        </svg>
        <span>Powered by Gemini</span>
      </div>
    </div>
  );
}
