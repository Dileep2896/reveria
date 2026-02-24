import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './director-panel.css';
import DirectorHelpModal from './director/DirectorHelpModal';
import DirectorEmptyState from './director/DirectorEmptyState';
import DirectorAnalyzing from './director/DirectorAnalyzing';
import DirectorCardList from './director/DirectorCardList';
import DirectorChat from './DirectorChat';

export default function DirectorPanel({
  data, generating, sceneNumbers, sceneTitles, imageTiers,
  portraits = [], portraitsLoading = false, language, liveNotes = [],
  chatActive, chatMessages = [], chatLoading, chatPrompt,
  autoGenerate, onCancelAutoGenerate,
  onStartChat, onEndChat, onChatAudio, onChatSuggest, onUsePrompt,
}) {
  const isAnalyzing = generating && !data;
  const hasLiveNotes = liveNotes.length > 0;
  const [expandedCards, setExpandedCards] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [liveNotesOpen, setLiveNotesOpen] = useState(true);
  const [playingNoteIdx, setPlayingNoteIdx] = useState(null);
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

  // Auto-play Director voice commentary
  const playedRef = useRef(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = useCallback((url, noteIdx) => {
    if (!url) return;
    // If same note is already playing, stop it (toggle off)
    if (playingNoteIdx === noteIdx && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingNoteIdx(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.onended = () => {
      setPlayingNoteIdx(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingNoteIdx(noteIdx);
  }, [playingNoteIdx]);

  // Auto-play new notes
  useEffect(() => {
    if (!liveNotes.length) {
      playedRef.current = new Set();
      return;
    }
    const latestIdx = liveNotes.length - 1;
    const latest = liveNotes[latestIdx];
    const key = `${latest.scene_number}`;
    if (latest.audio_url && !playedRef.current.has(key)) {
      playedRef.current.add(key);
      playAudio(latest.audio_url, latestIdx);
    }
  }, [liveNotes, playAudio]);

  return (
    <div
      className="director-panel flex-shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
        backdropFilter: 'var(--glass-blur-strong)',
        WebkitBackdropFilter: 'var(--glass-blur-strong)',
        borderLeft: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-2.5"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--accent-secondary-soft)',
            border: '1px solid var(--glass-border-secondary)',
            boxShadow: 'var(--shadow-glow-secondary)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--accent-secondary)', flex: 1 }}
        >
          Director
        </h2>
        {language && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              color: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)',
              border: '1px solid var(--glass-border-accent)',
              letterSpacing: '0.03em',
            }}
          >
            {language}
          </span>
        )}
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Director guide"
          title="What do these cards mean?"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-secondary-soft)';
            e.currentTarget.style.color = 'var(--accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ?
        </button>
      </div>

      {helpOpen && createPortal(
        <DirectorHelpModal onClose={() => setHelpOpen(false)} />,
        document.body,
      )}

      {/* ── Live Agent CTA ── */}
      {!chatActive && (
        <button onClick={onStartChat} className="live-agent-cta">
          <div className="live-agent-cta-glow" />
          <div className="live-agent-cta-content">
            {/* Animated orb */}
            <div className="live-agent-orb">
              <div className="live-agent-orb-ring live-agent-orb-ring-1" />
              <div className="live-agent-orb-ring live-agent-orb-ring-2" />
              <div className="live-agent-orb-inner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
              </div>
            </div>
            {/* Text */}
            <div className="live-agent-text">
              <span className="live-agent-title">Talk to Director</span>
              <span className="live-agent-subtitle">
                Voice brainstorm your next scene
              </span>
            </div>
            {/* Live badge */}
            <div className="live-agent-badge">
              <span className="live-agent-dot" />
              LIVE
            </div>
          </div>
          {/* Animated waveform accent */}
          <div className="live-agent-wave">
            {[0,1,2,3,4,5,6,7].map(i => (
              <span key={i} className="live-agent-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </button>
      )}

      {/* Voice chat orb — above the notes */}
      {chatActive && (
        <DirectorChat
          onSendAudio={onChatAudio}
          onEndChat={onEndChat}
          onSuggestPrompt={onChatSuggest}
          onUsePrompt={onUsePrompt}
          messages={chatMessages}
          suggestedPrompt={chatPrompt}
          chatLoading={chatLoading}
          autoGenerate={autoGenerate}
          onCancelAutoGenerate={onCancelAutoGenerate}
        />
      )}

      {/* Scrollable notes + cards body */}
      <div className="director-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Live commentary during generation */}
        {hasLiveNotes && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setLiveNotesOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: liveNotesOpen ? '12px' : 0,
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--accent-primary-soft)',
                border: '1px solid var(--glass-border-accent)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                animation: generating ? 'analyzePulse 2s ease-in-out infinite' : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent-primary)',
                flex: 1,
              }}>
                {generating ? 'Live Commentary' : "Director's Notes"}
              </span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: liveNotesOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M1 1l4 4 4-4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {liveNotesOpen && liveNotes.map((note, i) => (
              <div
                key={`live-${note.scene_number}-${i}`}
                className="director-live-note"
                style={{
                  marginBottom: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'var(--glass-blur)',
                  animation: 'directorLiveIn 0.4s ease-out both',
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px', lineHeight: 1 }}>{note.emoji}</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--accent-secondary)',
                  }}>
                    Scene {note.scene_number}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: 'var(--accent-secondary-soft)',
                    color: 'var(--accent-secondary)',
                    border: '1px solid var(--glass-border-secondary)',
                    marginLeft: 'auto',
                  }}>
                    {note.mood}
                  </span>
                  {note.audio_url && (
                    <button
                      onClick={() => playAudio(note.audio_url, i)}
                      title={playingNoteIdx === i ? "Stop playback" : "Replay Director's voice"}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: playingNoteIdx === i ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
                        border: `1px solid ${playingNoteIdx === i ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
                        cursor: 'pointer',
                        color: 'var(--accent-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      {playingNoteIdx === i ? (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      ) : (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                <p style={{
                  fontSize: '11px',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  margin: '0 0 6px 0',
                }}>
                  {note.thought}
                </p>
                <p style={{
                  fontSize: '10px',
                  lineHeight: 1.4,
                  color: 'var(--text-muted)',
                  margin: 0,
                  fontStyle: 'italic',
                }}>
                  {note.craft_note}
                </p>
                {/* Tension meter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Tension</span>
                  <div style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: 'var(--glass-bg-strong)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(note.tension_level || 5) * 10}%`,
                      height: '100%',
                      borderRadius: '2px',
                      background: (note.tension_level || 5) >= 7
                        ? 'var(--status-error, #ef4444)'
                        : (note.tension_level || 5) >= 4
                          ? 'var(--accent-primary)'
                          : 'var(--accent-secondary)',
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '14px', textAlign: 'right' }}>
                    {note.tension_level}/10
                  </span>
                </div>
                {/* Director's proactive suggestion — inline within the scene card */}
                {note.suggestion && i === liveNotes.length - 1 && (
                  <>
                    <div style={{
                      height: '1px',
                      background: 'var(--glass-border)',
                      margin: '10px -14px 8px',
                    }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                      </svg>
                      <div>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--accent-secondary)',
                        }}>
                          Next Direction
                        </span>
                        <p style={{
                          fontSize: '10px',
                          lineHeight: 1.5,
                          color: 'var(--text-primary)',
                          margin: '2px 0 0',
                          fontWeight: 500,
                        }}>
                          {note.suggestion}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!data && !isAnalyzing && !hasLiveNotes ? (
          <DirectorEmptyState language={language} />
        ) : isAnalyzing && !hasLiveNotes ? (
          <DirectorAnalyzing />
        ) : data ? (
          <DirectorCardList
            data={data}
            expandedCards={expandedCards}
            toggleCard={toggleCard}
            sceneNumbers={sceneNumbers}
            sceneTitles={sceneTitles}
            imageTiers={imageTiers}
            portraits={portraits}
            portraitsLoading={portraitsLoading}
          />
        ) : isAnalyzing ? (
          <DirectorAnalyzing />
        ) : null}
      </div>
    </div>
  );
}
