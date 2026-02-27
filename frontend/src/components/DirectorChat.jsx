import { useState, useRef, useEffect, useCallback } from 'react';
import useVoiceCapture from '../hooks/useVoiceCapture';

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
}) {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const playedIds = useRef(new Set());
  const prevSpeakingRef = useRef(false);
  const mountedRef = useRef(true);

  const handleAudioCaptured = useCallback(
    (b64, mime) => onSendAudio?.(b64, mime),
    [onSendAudio],
  );

  const { recording, startRecording, stopRecording, abortRecording } = useVoiceCapture({
    onAudioCaptured: handleAudioCaptured,
  });

  // Auto-play Director audio and track speaking state
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
      audio.onplay = () => { playStarted = true; if (mountedRef.current) setSpeaking(true); };
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

  // Auto-resume recording after Director finishes speaking
  useEffect(() => {
    if (speaking) {
      prevSpeakingRef.current = true;
    } else if (prevSpeakingRef.current) {
      prevSpeakingRef.current = false;
      // Don't auto-resume during generation or cast photo upload flow
      if (generating || castAnalyzing) return;
      // Director just finished → auto-start listening after a brief pause
      const timer = setTimeout(() => {
        if (mountedRef.current) startRecording();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [speaking, startRecording, generating, castAnalyzing]);

  // Abort recording (discard audio) when cast photo upload or Director speaking starts
  useEffect(() => {
    if ((castAnalyzing || speaking) && recording) abortRecording();
  }, [castAnalyzing, speaking, recording, abortRecording]);

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
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const orbState = castAnalyzing
    ? 'waiting'
    : recording
      ? 'recording'
      : speaking
        ? 'speaking'
        : chatLoading
          ? 'loading'
          : generating
            ? 'watching'
            : 'idle';

  // Toggle: tap to start recording, tap again to send
  const handleOrbClick = () => {
    if (orbState === 'waiting') return; // blocked during cast upload
    if (recording) {
      stopRecording(); // sends audio automatically via onAudioCaptured
    } else if (orbState === 'idle') {
      startRecording();
    }
    // Ignore clicks during speaking/loading
  };

  return (
    <div className="director-voice-section">
      {/* Voice Orb */}
      <button
        className={`director-voice-orb ${orbState}`}
        onClick={handleOrbClick}
        aria-label={orbState === 'waiting' ? 'Analyzing hero photo' : recording ? 'Stop recording' : chatLoading ? 'Director is thinking' : speaking ? 'Director is speaking' : generating ? 'Director is watching' : 'Start recording'}
        type="button"
      >
        {/* Animated rings */}
        <div className="voice-ring voice-ring-1" />
        <div className="voice-ring voice-ring-2" />
        <div className="voice-ring voice-ring-3" />

        {/* Glow background */}
        <div className="voice-glow" />

        {/* Inner orb */}
        <div className="voice-orb-inner">
          {orbState === 'waiting' ? (
            <div className="voice-watching">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          ) : orbState === 'watching' ? (
            <div className="voice-watching">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          ) : orbState === 'speaking' ? (
            <div className="voice-wave">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="voice-wave-bar"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          ) : orbState === 'loading' ? (
            <div className="voice-loading">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="voice-loading-dot"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          ) : recording ? (
            /* Recording — show stop/send icon */
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
          ) : (
            /* Idle — show mic icon */
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            <span className="voice-autogen-label">Generating in 5s...</span>
          </div>
          <p className="voice-autogen-prompt">{autoGenerate.prompt}</p>
          <button onClick={onCancelAutoGenerate} className="voice-autogen-cancel">
            Cancel
          </button>
        </div>
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
