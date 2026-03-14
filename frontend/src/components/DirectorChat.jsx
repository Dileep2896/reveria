import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useVoiceCapture from '../hooks/useVoiceCapture';
import useStreamingAudio from '../hooks/useStreamingAudio';
import VoiceOrb from './VoiceOrb';
import Tooltip from './Tooltip';

const DC_DEBUG = true;
const dcLog = (...args) => DC_DEBUG && console.log('%c[DirectorChat]', 'color: #b48cff; font-weight: bold', ...args);
const dcWarn = (...args) => DC_DEBUG && console.warn('%c[DirectorChat]', 'color: #ffa86c; font-weight: bold', ...args);

export default function DirectorChat({
  onSendAudio,
  onSendAudioChunk,
  onAudioStreamStart,
  onAudioStreamEnd,
  onSendText,
  onNudge,
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
  demoSpeaking = false,
  demoListening = false,
  setAudioChunkHandler,
  setAudioDoneHandler,
}) {
  const [speaking, setSpeaking] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const showTextInputRef = useRef(false);
  showTextInputRef.current = showTextInput;
  const audioRef = useRef(null);
  const playedIds = useRef(new Set());
  const mountedRef = useRef(true);
  const autoplayFallbackRef = useRef(null);
  const transcriptEndRef = useRef(null);
  // Hard stop flag — blocks ALL automatic recording restarts.
  // Only cleared by explicit user tap on the orb.
  const idledOutRef = useRef(false);

  // Streaming audio for low-latency Director responses
  const streamResponseIdRef = useRef(0);
  const lastNoiseRejectedRef = useRef(false);
  const activeResponseIdRef = useRef(0);
  const { playing: streamPlaying, feedChunk, stop: stopStreaming, reset: resetStreaming, getAmplitude: getStreamAmplitude } = useStreamingAudio({
    onPlaybackStart: () => {
      dcLog('🔊 Streaming playback STARTED');
      if (mountedRef.current) setSpeaking(true);
    },
    onPlaybackEnd: () => {
      dcLog('🔇 Streaming playback ENDED');
      if (mountedRef.current) setSpeaking(false);
    },
  });

  // Register streaming handlers with WS layer
  useEffect(() => {
    if (setAudioChunkHandler) {
      setAudioChunkHandler((b64data) => {
        const currentId = streamResponseIdRef.current;
        if (activeResponseIdRef.current !== currentId) {
          dcLog(`🎵 New streaming response #${currentId}`);
          resetStreaming();
          activeResponseIdRef.current = currentId;
        }
        feedChunk(b64data);
      });
    }
    if (setAudioDoneHandler) {
      setAudioDoneHandler((data) => {
        const newId = streamResponseIdRef.current + 1;
        dcLog(`✅ Audio stream DONE (#${streamResponseIdRef.current} → #${newId})`);
        streamResponseIdRef.current = newId;
        if (data?.noise_rejected) {
          lastNoiseRejectedRef.current = true;
        }
        if (data?.flagged) {
          dcWarn('Security flagged — killing playback');
          stopStreaming();
        }
      });
    }
    return () => {
      if (setAudioChunkHandler) setAudioChunkHandler(null);
      if (setAudioDoneHandler) setAudioDoneHandler(null);
    };
  }, [setAudioChunkHandler, setAudioDoneHandler, feedChunk, resetStreaming, stopStreaming]);

  // Countdown timer for auto-generate
  useEffect(() => {
    if (!autoGenerate) { setCountdown(5); setPromptExpanded(false); return; }
    const start = autoGenerate.countdownStart || 5;
    setCountdown(start);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [autoGenerate]);

  // Streaming audio callbacks — replace blob-based handleAudioCaptured
  const handleAudioChunk = useCallback(
    (b64chunk) => {
      onSendAudioChunk?.(b64chunk);
    },
    [onSendAudioChunk],
  );

  const handleStreamStart = useCallback(() => {
    nudgeCountRef.current = 0;
    dcLog('🎤 Audio stream started (server-side VAD)');
    onAudioStreamStart?.();
  }, [onAudioStreamStart]);

  const handleStreamEnd = useCallback(() => {
    dcLog('🎤 Audio stream ended');
    // If Director is already speaking (responded mid-stream), don't send
    // stream-end — backend already has the response and cleaned up.
    if (!speakingRef.current) {
      onAudioStreamEnd?.();
    }
  }, [onAudioStreamEnd]);

  const generatingRef = useRef(generating);
  generatingRef.current = generating;
  const autoGenerateRef = useRef(autoGenerate);
  autoGenerateRef.current = autoGenerate;
  const nudgeCountRef = useRef(0);
  const MAX_NUDGES = 2;

  const NUDGE_PROMPTS = [
    // Nudge 1: Acknowledge silence warmly, ask a specific creative question
    '[SYSTEM: The user has been quiet for a while. Acknowledge it naturally — '
    + "something like \"Hey, still thinking? No rush!\" or \"Take your time, I'm here when you're ready.\" "
    + 'Then ask ONE specific creative question about the story to get them talking again. '
    + 'Keep it warm, brief (1-2 sentences). Do NOT call generate_story.]',
    // Nudge 2: More proactive — offer a concrete suggestion they can just say yes to
    '[SYSTEM: The user is still quiet. Be more proactive this time — '
    + "say something like \"Tell you what — how about we try this:\" and then pitch a specific, "
    + 'exciting story direction based on what you\'ve discussed so far. Make it easy for them '
    + 'to just say "yes" or "no". Keep it brief (2-3 sentences). Do NOT call generate_story.]',
  ];

  const abortRecordingRef = useRef(null);
  const handleIdleTimeout = useCallback(() => {
    if (generatingRef.current) return;
    if (nudgeCountRef.current >= MAX_NUDGES) {
      dcLog(`⏰ Idle — max nudges reached, stopping recording. Tap orb to speak.`);
      idledOutRef.current = true; // Hard stop — only user tap clears this
      abortRecordingRef.current?.();
      return;
    }
    const idx = nudgeCountRef.current;
    nudgeCountRef.current++;
    dcLog(`⏰ Idle — nudging Director (#${nudgeCountRef.current}/${MAX_NUDGES})`);
    onNudge?.(NUDGE_PROMPTS[idx] || NUDGE_PROMPTS[NUDGE_PROMPTS.length - 1]);
  }, [onNudge]);

  const { recording, startRecording, stopRecording, abortRecording, resetIdleTimer, getAmplitude: getMicAmplitude, releaseStream } = useVoiceCapture({
    onAudioChunk: handleAudioChunk,
    onStreamStart: handleStreamStart,
    onStreamEnd: handleStreamEnd,
    onIdleTimeout: handleIdleTimeout,
  });
  abortRecordingRef.current = abortRecording;

  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  // Auto-play Director audio for legacy path (greeting / tool call responses)
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (
      latest?.role === 'director' &&
      latest.audioUrl &&
      !playedIds.current.has(latest.id)
    ) {
      dcLog(`🔊 Legacy audio: id=${latest.id}`);
      playedIds.current.add(latest.id);
      if (playedIds.current.size > 100) {
        const ids = [...playedIds.current];
        playedIds.current = new Set(ids.slice(-50));
      }
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (autoplayFallbackRef.current) {
        clearTimeout(autoplayFallbackRef.current);
        autoplayFallbackRef.current = null;
      }
      const audio = new Audio(latest.audioUrl);
      audio.volume = 0.7;
      let playStarted = false;
      audio.onplay = () => {
        playStarted = true;
        dcLog('🔊 Legacy audio PLAYING');
        if (mountedRef.current) setSpeaking(true);
      };
      audio.onended = () => {
        dcLog('🔊 Legacy audio ENDED');
        if (mountedRef.current) setSpeaking(false);
      };
      audio.onerror = (e) => {
        dcWarn('🔊 Legacy audio ERROR', e);
        if (mountedRef.current) setSpeaking(false);
      };
      audio.play().catch((err) => {
        dcWarn('🔊 Legacy audio play() rejected', err.message);
        if (autoplayFallbackRef.current) { clearTimeout(autoplayFallbackRef.current); autoplayFallbackRef.current = null; }
        if (mountedRef.current) setSpeaking(false);
      });
      autoplayFallbackRef.current = setTimeout(() => {
        autoplayFallbackRef.current = null;
        if (!playStarted && mountedRef.current) {
          dcLog('🔊 Autoplay blocked — going idle');
          setSpeaking(false);
        }
      }, 2000);
      audioRef.current = audio;
    }
  }, [messages]);

  // Auto-resume recording after Director finishes speaking
  // 500ms delay lets speaker echo dissipate before mic calibration starts,
  // preventing inflated noise floor that causes first speech attempt to be discarded.
  const wasSpeakingRef = useRef(false);
  const postSpeakTimerRef = useRef(null);
  useEffect(() => {
    if (speaking) {
      wasSpeakingRef.current = true;
      mutedRef.current = false; // Director started speaking naturally — clear manual mute
      consecutiveEmptyRef.current = 0; // Director spoke — reset empty counter
      // Clear any pending post-speak timer (Director started speaking again)
      if (postSpeakTimerRef.current) { clearTimeout(postSpeakTimerRef.current); postSpeakTimerRef.current = null; }
    } else if (wasSpeakingRef.current && !generating && !castAnalyzing && !recording) {
      wasSpeakingRef.current = false;
      if (mutedRef.current) {
        dcLog('🔄 Director muted — waiting for user to tap');
        mutedRef.current = false;
        return;
      }
      if (idledOutRef.current || autoGenerateRef.current) {
        dcLog(`🔄 Director finished speaking — ${idledOutRef.current ? 'idled out' : 'auto-generate pending'}, not recording`);
        return;
      }
      if (showTextInputRef.current) {
        dcLog('🔄 Director finished speaking — text input active, not recording');
        return;
      }
      dcLog('🔄 Director finished speaking — resuming in 500ms');
      postSpeakTimerRef.current = setTimeout(() => {
        postSpeakTimerRef.current = null;
        if (mountedRef.current && !recordingRef.current && !generatingRef.current
            && !idledOutRef.current && !autoGenerateRef.current && !showTextInputRef.current) {
          dcLog('🔄 Post-speak delay done — auto-starting recording');
          startRecording();
        }
      }, 500);
    }
    return () => {
      if (postSpeakTimerRef.current) { clearTimeout(postSpeakTimerRef.current); postSpeakTimerRef.current = null; }
    };
  }, [speaking, generating, castAnalyzing, recording, startRecording]);

  // Auto-resume when loading ends but Director never spoke (empty response)
  // Uses a short delay to avoid racing with greeting audio autoplay.
  // Limits consecutive empty responses to prevent infinite loop (noise → empty → resume → noise).
  // Skips auto-resume when loading was from a suggestion request (not user audio).
  const wasLoadingRef = useRef(false);
  const emptyResponseTimerRef = useRef(null);
  const consecutiveEmptyRef = useRef(0);
  const MAX_CONSECUTIVE_EMPTY = 2;
  const suggestionLoadingRef = useRef(false);
  useEffect(() => {
    if (chatLoading) {
      wasLoadingRef.current = true;
      if (emptyResponseTimerRef.current) { clearTimeout(emptyResponseTimerRef.current); emptyResponseTimerRef.current = null; }
    } else if (wasLoadingRef.current && !speaking && !generating && !castAnalyzing && !recording) {
      wasLoadingRef.current = false;
      if (suggestionLoadingRef.current) {
        suggestionLoadingRef.current = false;
        dcLog('🔄 Suggestion response — skipping auto-resume');
        return;
      }
      const wasNoise = lastNoiseRejectedRef.current;
      lastNoiseRejectedRef.current = false;
      consecutiveEmptyRef.current++;
      if (consecutiveEmptyRef.current > MAX_CONSECUTIVE_EMPTY) {
        dcLog(`🔄 ${consecutiveEmptyRef.current} consecutive empty/noise responses — stopping (tap to speak)`);
        return;
      }
      if (wasNoise) {
        dcLog(`🔄 Noise rejected (#${consecutiveEmptyRef.current}) — auto-resuming recording`);
      }
      // Wait 800ms — if Director starts speaking in that time, the wasSpeaking effect handles it
      emptyResponseTimerRef.current = setTimeout(() => {
        emptyResponseTimerRef.current = null;
        if (mountedRef.current && !recordingRef.current && !generatingRef.current && !idledOutRef.current && !autoGenerateRef.current && !showTextInputRef.current) {
          dcLog(`🔄 Empty response (#${consecutiveEmptyRef.current}) — auto-resuming recording`);
          startRecording();
        }
      }, 800);
    } else {
      wasLoadingRef.current = false;
    }
    return () => {
      if (emptyResponseTimerRef.current) { clearTimeout(emptyResponseTimerRef.current); emptyResponseTimerRef.current = null; }
    };
  }, [chatLoading, speaking, generating, castAnalyzing, recording, startRecording]);

  // Abort recording when generation, auto-generate countdown, cast analysis, or text input starts.
  // Stop (gracefully with stream-end signal) when Director starts speaking mid-stream.
  // Resume recording when text input closes (if nothing else is blocking).
  const prevShowTextRef = useRef(false);
  useEffect(() => {
    if ((castAnalyzing || generating || autoGenerate || showTextInput) && recording) {
      dcLog(`🛑 ${castAnalyzing ? 'Cast analyzing' : generating ? 'Generation' : autoGenerate ? 'Auto-generate pending' : 'Text input active'} — aborting recording`);
      abortRecording();
    }
    // Director started speaking while mic is still streaming — stop gracefully
    // so the backend receives the stream-end signal
    if (speaking && recording) {
      dcLog('🛑 Director speaking — stopping recording (stream end)');
      stopRecording();
    }
    // Text input just closed — resume recording
    if (prevShowTextRef.current && !showTextInput && !recording && !generating && !castAnalyzing && !speaking && !chatLoading && !autoGenerate) {
      dcLog('🔄 Text input closed — auto-resuming recording');
      startRecording();
    }
    prevShowTextRef.current = showTextInput;
  }, [castAnalyzing, generating, autoGenerate, showTextInput, recording, abortRecording, stopRecording, speaking, chatLoading, startRecording]);

  // When generation ends: reset counters. Don't auto-resume recording immediately —
  // wait for Director wrapup audio to play first (arrives ~3-6s after generation ends).
  // The wasSpeaking effect handles auto-resume after wrapup finishes.
  // This is just a fallback if no wrapup arrives.
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (prevGeneratingRef.current && !generating) {
      nudgeCountRef.current = 0;
      consecutiveEmptyRef.current = 0;
      idledOutRef.current = false;
      // Fallback: if Director wrapup doesn't arrive within 10s, auto-resume
      const timer = setTimeout(() => {
        if (mountedRef.current && !recordingRef.current && !generatingRef.current
            && !idledOutRef.current && !autoGenerateRef.current && !speakingRef.current && !showTextInputRef.current) {
          dcLog('🔄 Post-generation fallback — no wrapup arrived, auto-resuming recording');
          startRecording();
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
    prevGeneratingRef.current = generating;
  }, [generating, startRecording]);

  // Pause recording when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && recordingRef.current) abortRecording();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [abortRecording]);

  // Loading safety timeout — if stuck in "thinking" for 35s, reset
  const loadingTimerRef = useRef(null);
  useEffect(() => {
    // Always clear previous timer first
    if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
    if (chatLoading) {
      loadingTimerRef.current = setTimeout(() => {
        dcWarn('⏱️ Loading timeout (35s) — resetting to idle');
        if (mountedRef.current && !generatingRef.current && !recordingRef.current && !idledOutRef.current) {
          dcLog('⏱️ Auto-recovering from stuck loading state');
          startRecording();
        }
      }, 35000);
    }
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [chatLoading, startRecording]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      dcLog('🧹 DirectorChat UNMOUNTING');
      mountedRef.current = false;
      abortRecording();
      releaseStream();
      stopStreaming();
      if (autoplayFallbackRef.current) {
        clearTimeout(autoplayFallbackRef.current);
        autoplayFallbackRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [stopStreaming, abortRecording, releaseStream]);

  // Amplitude getter for orb visualization
  const getOrbAmplitude = useCallback(() => {
    if (demoSpeaking) return 0.15 + Math.sin(Date.now() * 0.008) * 0.12 + Math.random() * 0.08;
    if (recording) return getMicAmplitude();
    if (streamPlaying) return getStreamAmplitude();
    if (speaking) return 0.15 + Math.sin(Date.now() * 0.008) * 0.1;
    return 0;
  }, [demoSpeaking, recording, streamPlaying, speaking, getMicAmplitude, getStreamAmplitude]);

  const orbState = demoSpeaking
    ? 'speaking'
    : demoListening
    ? 'recording'
    : castAnalyzing
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

  // Log orb state changes
  const prevOrbStateRef = useRef(orbState);
  if (prevOrbStateRef.current !== orbState) {
    dcLog(`🔮 Orb: ${prevOrbStateRef.current} → ${orbState}`);
    prevOrbStateRef.current = orbState;
  }

  // Mute: stop Director audio playback (don't start recording — user taps again)
  const mutedRef = useRef(false);
  const handleMute = useCallback(() => {
    dcLog('👆 TAP TO MUTE');
    mutedRef.current = true; // Prevent auto-resume after this manual stop
    setSpeaking(false);
    stopStreaming();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
  }, [stopStreaming]);

  const handleOrbClick = () => {
    dcLog(`👆 Orb clicked (state=${orbState})`);
    if (orbState === 'waiting' || orbState === 'loading' || orbState === 'watching') return;
    // User tap always clears idled-out state and resets nudges
    idledOutRef.current = false;
    mutedRef.current = false;
    nudgeCountRef.current = 0;
    consecutiveEmptyRef.current = 0;
    if (orbState === 'speaking') {
      handleMute();
    } else if (recording) {
      stopRecording();
    } else if (orbState === 'idle') {
      if (showTextInput) setShowTextInput(false);
      startRecording();
    }
  };

  // Build transcript messages for display (filter out audio-only entries)
  const transcriptMessages = messages.filter(m => m.transcript);

  return (
    <div className="director-voice-section">
      {/* Transcript thread */}
      {transcriptMessages.length > 0 && showTranscript && (
        <div className="director-transcript-thread">
          {transcriptMessages.map((m) => (
            <div key={m.id} className={`director-transcript-msg ${m.role}`}>
              <div className="director-transcript-header">
                {m.role === 'director' ? (
                  <svg className="director-transcript-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                  </svg>
                ) : (
                  <svg className="director-transcript-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
                <span className="director-transcript-role">
                  {m.role === 'director' ? 'Director' : 'You'}
                </span>
              </div>
              <p className="director-transcript-text">{m.transcript}</p>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* Voice Orb */}
      <button
        className={`director-voice-orb-btn ${orbState}`}
        onClick={handleOrbClick}
        aria-label={
          orbState === 'waiting' ? 'Analyzing hero photo'
          : recording ? 'Stop recording'
          : chatLoading ? 'Director is thinking'
          : speaking ? 'Tap to mute'
          : generating ? 'Director is watching'
          : 'Tap to speak'
        }
        type="button"
      >
        <VoiceOrb mode={orbState} getAmplitude={getOrbAmplitude} size={72} />
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
            orbState === 'waiting' ? 'var(--accent-secondary)'
            : orbState === 'recording' ? 'var(--status-error, #ef4444)'
            : orbState === 'speaking' ? 'var(--accent-secondary)'
            : orbState === 'watching' ? 'var(--accent-primary)'
            : 'var(--text-muted)',
        }}
      >
        {orbState === 'waiting' ? 'Analyzing hero photo...'
          : orbState === 'recording' ? 'Listening...'
          : orbState === 'speaking' ? 'Tap to mute'
          : orbState === 'loading' ? 'Thinking...'
          : orbState === 'watching' ? 'Watching story unfold...'
          : showTextInput ? 'Type your message'
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
        <div className="prompt-dialog-overlay" onClick={() => setPromptExpanded(false)}>
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
      {suggestedPrompt && !autoGenerate && dismissedPrompt !== suggestedPrompt && (
        <div className="voice-suggestion-card">
          <div className="voice-suggestion-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            <span className="voice-suggestion-label">
              Suggested Prompt
            </span>
            <button
              className="voice-suggestion-close"
              onClick={() => setDismissedPrompt(suggestedPrompt)}
              aria-label="Dismiss suggestion"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
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

      {/* Text input (toggle with keyboard icon) */}
      {showTextInput && (
        <form
          className="director-text-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            const msg = textInput.trim();
            if (!msg || chatLoading) return;
            dcLog('⌨️ Sending text:', msg);
            onSendText?.(msg);
            setTextInput('');
          }}
        >
          <div className={`director-text-input-wrapper${textInput.trim() ? ' has-text' : ''}`}>
            <input
              type="text"
              className="director-text-input"
              placeholder="Message the Director..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={chatLoading || generating}
              autoFocus
            />
            <button
              type="submit"
              className="director-text-send"
              disabled={!textInput.trim() || chatLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {/* Action buttons — two rows */}
      <div className="voice-actions-group">
        <div className="voice-actions">
          <Tooltip label="Type instead of speaking">
          <button
            onClick={() => setShowTextInput(v => !v)}
            className={`voice-action-btn voice-type-btn ${showTextInput ? 'voice-text-active' : ''}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Type
          </button>
          </Tooltip>
          <button
            onClick={() => { suggestionLoadingRef.current = true; onSuggestPrompt?.(); }}
            disabled={chatLoading || recording}
            className="voice-action-btn voice-suggest-btn"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            Suggest
          </button>
        </div>
        <div className="voice-actions">
          {transcriptMessages.length > 0 && (
            <Tooltip label={showTranscript ? 'Hide transcript' : 'Show transcript'}>
            <button
              onClick={() => setShowTranscript(v => !v)}
              className={`voice-action-btn voice-transcript-btn ${showTranscript ? 'voice-transcript-active' : ''}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showTranscript ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              {showTranscript ? 'Hide' : 'Show'}
            </button>
            </Tooltip>
          )}
          <button
            onClick={() => {
              dcLog('🔴 End Chat clicked');
              abortRecording();
              releaseStream();
              stopStreaming();
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              onEndChat?.();
            }}
            className="voice-action-btn voice-end-btn"
          >
            End Chat
          </button>
        </div>
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
