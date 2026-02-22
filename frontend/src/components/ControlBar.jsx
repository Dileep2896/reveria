import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useVoiceCapture from '../hooks/useVoiceCapture';
import { ART_STYLES } from '../data/artStyles';
import { LANGUAGES, PLACEHOLDERS } from '../data/languages';

export default function ControlBar({ onSend, onSendAudio, connected, generating, quotaCooldown = 0, inputValue, setInputValue, artStyle, setArtStyle, language, setLanguage, languageLocked, live }) {
  const [focused, setFocused] = useState(false);
  const [sceneCount, setSceneCount] = useState(2);
  const [styleOpen, setStyleOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [langMenuPos, setLangMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const langTriggerRef = useRef(null);
  const langMenuRef = useRef(null);

  const openMenu = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
    }
    setStyleOpen(true);
  };

  const openLangMenu = () => {
    if (langTriggerRef.current) {
      const rect = langTriggerRef.current.getBoundingClientRect();
      setLangMenuPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
    }
    setLangOpen(true);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!styleOpen && !langOpen) return;
    const onClickOutside = (e) => {
      if (styleOpen) {
        if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
          setStyleOpen(false);
        }
      }
      if (langOpen) {
        if (!langMenuRef.current?.contains(e.target) && !langTriggerRef.current?.contains(e.target)) {
          setLangOpen(false);
        }
      }
    };
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [styleOpen, langOpen]);

  const { recording, startRecording, stopRecording } = useVoiceCapture({
    onAudioCaptured: (base64, mimeType) => {
      if (onSendAudio) onSendAudio(base64, mimeType);
    },
  });

  const isDisabled = !connected || generating || quotaCooldown > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isDisabled) return;
    onSend(inputValue.trim(), { artStyle, sceneCount, language });
    setInputValue('');
  };
  const hasText = inputValue.trim().length > 0;

  return (
    <div className="control-bar">
      <form onSubmit={handleSubmit} className="control-form">
        <div
          className="flex-1 flex items-center control-input-wrap"
          style={{
            position: 'relative',
            background: 'var(--glass-bg-input)',
            border: `1px solid ${quotaCooldown > 0 ? 'var(--status-error, #ef4444)' : generating ? 'var(--glass-border-accent)' : focused ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
            opacity: quotaCooldown > 0 ? 0.6 : 1,
            boxShadow: focused ? 'var(--shadow-glow-primary)' : 'var(--shadow-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            overflow: 'hidden',
          }}
        >
          {/* Generating shimmer overlay */}
          {generating && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRadius: 'inherit',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, var(--accent-primary-soft) 40%, var(--accent-primary-glow) 50%, var(--accent-primary-soft) 60%, transparent 100%)',
                  animation: 'controlShimmer 2s ease-in-out infinite',
                }}
              />
            </div>
          )}

          {/* Art style dropdown */}
          <div className="control-style-dropdown">
            <button
              ref={triggerRef}
              type="button"
              className="control-style-trigger"
              onClick={() => styleOpen ? setStyleOpen(false) : openMenu()}
            >
              <span>{ART_STYLES.find((s) => s.key === artStyle)?.label}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: styleOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {styleOpen && menuPos && createPortal(
              <div ref={menuRef} className="control-style-menu" style={{ bottom: menuPos.bottom, left: menuPos.left }}>
                {ART_STYLES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`control-style-option${key === artStyle ? ' active' : ''}`}
                    onClick={() => { setArtStyle(key); setStyleOpen(false); }}
                  >
                    {key === artStyle && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Scene count toggle (1 or 2) */}
          <div className="control-scene-count">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                className={`control-scene-btn${sceneCount === n ? ' active' : ''}`}
                onClick={() => setSceneCount(n)}
                title={`Generate ${n} scene${n > 1 ? 's' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Language dropdown — only for new books before first generation */}
          {!languageLocked && (
          <div className="control-style-dropdown">
            <button
              ref={langTriggerRef}
              type="button"
              className="control-style-trigger"
              onClick={() => langOpen ? setLangOpen(false) : openLangMenu()}
            >
              <span>{LANGUAGES.find((l) => l.key === language)?.label || 'English'}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: langOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {langOpen && langMenuPos && createPortal(
              <div ref={langMenuRef} className="control-style-menu" style={{ bottom: langMenuPos.bottom, left: langMenuPos.left }}>
                {LANGUAGES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`control-style-option${key === language ? ' active' : ''}`}
                    onClick={() => { setLanguage(key); setLangOpen(false); }}
                  >
                    {key === language && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
          )}

          <div className="control-input-divider" />

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={recording ? 'Listening... click mic to stop' : quotaCooldown > 0 ? `Image quota exhausted — retry in ${quotaCooldown}s` : generating ? 'Story is being crafted...' : (PLACEHOLDERS[language] || PLACEHOLDERS.English)}
            disabled={isDisabled}
            className="flex-1 bg-transparent outline-none control-input"
            style={{ color: 'var(--text-primary)', resize: 'none' }}
            rows={1}
          />

          {/* Single morphing action button: mic → send → spinner */}
          {generating ? (
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center control-action-btn"
              style={{
                background: 'var(--accent-primary-soft)',
                border: '1px solid var(--glass-border-accent)',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid var(--glass-border-accent)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          ) : hasText ? (
            <button
              type="submit"
              disabled={isDisabled}
              className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: '1px solid var(--accent-primary)',
                boxShadow: 'var(--shadow-glow-primary)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.3 : 1,
              }}
              title="Send"
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
              style={{
                background: recording ? 'var(--accent-primary)' : 'var(--glass-bg)',
                color: recording ? 'var(--text-inverse)' : 'var(--text-muted)',
                border: `1px solid ${recording ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                boxShadow: recording ? '0 0 12px var(--accent-primary)' : 'none',
                animation: recording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
                opacity: isDisabled ? 0.3 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
              title={recording ? 'Click to stop' : 'Click to record'}
              onClick={!isDisabled ? (recording ? stopRecording : startRecording) : undefined}
              disabled={isDisabled}
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </div>

        {/* Live toggle button — inline in form */}
        {live && (
          <button
            type="button"
            onClick={live.isLive ? live.stopLive : live.startLive}
            disabled={!connected || generating}
            className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
            style={{
              background: live.isLive ? 'var(--accent-primary)' : 'var(--glass-bg)',
              border: `1px solid ${live.isLive ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
              color: live.isLive ? '#fff' : 'var(--text-muted)',
              cursor: !connected || generating ? 'not-allowed' : 'pointer',
              opacity: !connected || generating ? 0.3 : 1,
              boxShadow: live.isLive ? '0 0 16px var(--accent-primary)' : 'none',
              animation: live.isLive ? 'micPulse 1.5s ease-in-out infinite' : 'none',
            }}
            title={live.isLive ? 'Stop live conversation' : 'Start live conversation with Gemini'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10l1 2 2-3 2 5 2-4 2 3 2-6 2 4 2-2 2 3 2-5 1 3" />
              <circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
      </form>

      {/* Live conversation transcript overlay */}
      {live?.isLive && live.transcript.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '600px', maxHeight: '200px', overflowY: 'auto',
          marginBottom: '8px', borderRadius: '12px',
          background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)',
          backdropFilter: 'var(--glass-blur)', padding: '12px',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {live.transcript.slice(-6).map((msg, i) => (
            <div key={i} style={{
              fontSize: '0.8rem', lineHeight: 1.5,
              color: msg.role === 'user' ? 'var(--accent-primary)' : msg.role === 'system' ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontStyle: msg.role === 'system' ? 'italic' : 'normal',
            }}>
              <strong style={{ opacity: 0.6 }}>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Gemini'}:</strong>{' '}
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Ready prompt action */}
      {live?.readyPrompt && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: live.transcript.length > 0 ? '220px' : '8px',
          background: 'var(--accent-primary-soft)', border: '1px solid var(--glass-border-accent)',
          borderRadius: '12px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '500px',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, margin: 0 }}>
            {live.readyPrompt.slice(0, 120)}...
          </p>
          <button
            onClick={() => {
              setInputValue(live.readyPrompt);
              live.clearPrompt();
              live.stopLive();
            }}
            style={{
              padding: '4px 12px', borderRadius: '999px', border: 'none',
              background: 'var(--accent-primary)', color: '#fff', fontSize: '0.75rem',
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Use prompt
          </button>
        </div>
      )}

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 8px var(--accent-primary); }
          50% { box-shadow: 0 0 20px var(--accent-primary); }
        }
        @keyframes controlShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
