import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL_BASE = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws').replace(/\/ws\/?$/, '').replace(/^ws/, 'http');

const VOICES = [
  { id: 'Charon', label: 'Charon', desc: 'Deep & dramatic' },
  { id: 'Kore', label: 'Kore', desc: 'Warm & nurturing' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Bold & commanding' },
  { id: 'Aoede', label: 'Aoede', desc: 'Lyrical & expressive' },
  { id: 'Puck', label: 'Puck', desc: 'Playful & energetic' },
  { id: 'Orus', label: 'Orus', desc: 'Calm & wise' },
  { id: 'Leda', label: 'Leda', desc: 'Elegant & refined' },
  { id: 'Zephyr', label: 'Zephyr', desc: 'Breezy & casual' },
];

export default function SettingsDialog({ onClose, theme, toggleTheme, directorVoice, setDirectorVoice }) {
  const [previewLoading, setPreviewLoading] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const audioRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Cleanup audio + abort on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (abortRef.current) { abortRef.current.abort(); }
    };
  }, []);

  const handleVoiceClick = useCallback(async (voiceId) => {
    setDirectorVoice(voiceId);

    // Stop any current preview
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); }
    setPreviewPlaying(null);

    // Fetch preview
    setPreviewLoading(voiceId);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${WS_URL_BASE}/api/voice-preview/${voiceId}`, { signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;

      if (data.audio_url) {
        const audio = new Audio(data.audio_url);
        audioRef.current = audio;
        setPreviewPlaying(voiceId);
        setPreviewLoading(null);
        audio.onended = () => { setPreviewPlaying(null); audioRef.current = null; };
        audio.onerror = () => { setPreviewPlaying(null); audioRef.current = null; };
        audio.play().catch(() => { setPreviewPlaying(null); });
      } else {
        setPreviewLoading(null);
      }
    } catch {
      if (!controller.signal.aborted) setPreviewLoading(null);
    }
  }, [setDirectorVoice]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.25s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--glass-bg-strong)',
          border: '1px solid var(--glass-border)',
          borderRadius: '1.25rem',
          padding: '2rem 2rem 1.5rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 40px var(--accent-primary-glow)',
          animation: 'dialogPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--accent-primary-soft)',
            border: '1px solid var(--glass-border-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px var(--accent-primary-glow)',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Settings
          </h3>
        </div>

        {/* ── Appearance ── */}
        <div style={{ marginBottom: '1.4rem' }}>
          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
          }}>
            Appearance
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '999px',
            padding: '3px',
          }}>
            <button
              onClick={() => { if (theme === 'dark') toggleTheme(); }}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: '999px',
                border: 'none',
                background: theme === 'light' ? 'var(--accent-primary)' : 'transparent',
                color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              Light
            </button>
            <button
              onClick={() => { if (theme === 'light') toggleTheme(); }}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: '999px',
                border: 'none',
                background: theme === 'dark' ? 'var(--accent-primary)' : 'transparent',
                color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              Dark
            </button>
          </div>
        </div>

        {/* ── Director Voice ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
          }}>
            Director Voice
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}>
            {VOICES.map((v) => {
              const isActive = directorVoice === v.id;
              const isLoading = previewLoading === v.id;
              const isPlaying = previewPlaying === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleVoiceClick(v.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: `1px solid ${isActive ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
                    background: isActive ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isActive ? 'var(--accent-secondary)' : 'var(--text-primary)',
                      marginBottom: '1px',
                      flex: 1,
                    }}>
                      {v.label}
                    </div>
                    {isLoading && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                      </svg>
                    )}
                    {isPlaying && (
                      <div style={{ display: 'flex', gap: '1.5px', alignItems: 'flex-end', height: '12px', flexShrink: 0 }}>
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            style={{
                              width: '2.5px',
                              borderRadius: '1px',
                              background: 'var(--accent-primary)',
                              animation: `voiceBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.02em',
                  }}>
                    {v.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Done button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            className="transition-all"
            style={{
              padding: '0.55rem 2rem',
              borderRadius: '999px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 4px 16px var(--accent-primary-glow)',
            }}
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes voiceBar {
          0% { height: 3px; }
          100% { height: 12px; }
        }
      `}</style>
    </div>
  );
}
