import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useVoiceCapture from '../hooks/useVoiceCapture';
import { ART_STYLES } from '../data/artStyles';
import { PLACEHOLDERS } from '../data/languages';

export default function ControlBar({ onSend, onSendAudio, onSteer, connected, generating, quotaCooldown = 0, inputValue, setInputValue, artStyle, setArtStyle, language, usage, onHeroPhoto, heroMode }) {
  const [focused, setFocused] = useState(false);
  const [heroPhoto, setHeroPhotoRaw] = useState(() => {
    try { return localStorage.getItem('storyforge-hero-photo'); } catch { return null; }
  });
  const setHeroPhoto = useCallback((v) => {
    setHeroPhotoRaw(v);
    try { if (v) localStorage.setItem('storyforge-hero-photo', v); else localStorage.removeItem('storyforge-hero-photo'); } catch { /* quota */ }
  }, []);
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroName, setHeroNameRaw] = useState(() => {
    try { return localStorage.getItem('storyforge-hero-name') || ''; } catch { return ''; }
  });
  const setHeroName = useCallback((v) => {
    setHeroNameRaw(v);
    try { if (v) localStorage.setItem('storyforge-hero-name', v); else localStorage.removeItem('storyforge-hero-name'); } catch { /* quota */ }
  }, []);
  // Name dialog state: pending file data before sending
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const nameDialogInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const sceneCount = 1;
  const [styleOpen, setStyleOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const heroActive = heroMode?.active || !!heroPhoto;
  const prevHeroActive = useRef(false);

  // Auto-switch to trend style when hero mode activates
  useEffect(() => {
    if (heroActive && !prevHeroActive.current) {
      const isTrend = ART_STYLES.find(s => s.key === artStyle)?.trend;
      if (!isTrend) setArtStyle('pixar');
      setHeroLoading(false);
      // Restore name from server on resume
      if (heroMode?.heroName) setHeroName(heroMode.heroName);
    }
    if (!heroActive && prevHeroActive.current) {
      setHeroLoading(false);
      setHeroName('');
    }
    prevHeroActive.current = heroActive;
  }, [heroActive, artStyle, setArtStyle, heroMode?.heroName, setHeroName]);

  // Focus name dialog input when it appears
  useEffect(() => {
    if (pendingPhoto && nameDialogInputRef.current) {
      nameDialogInputRef.current.focus();
    }
  }, [pendingPhoto]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Store pending photo data and show name dialog
        setPendingPhoto({ base64: reader.result, mimeType: file.type });
        setHeroName('');
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const confirmHeroUpload = useCallback(() => {
    if (!pendingPhoto) return;
    const name = heroName.trim();
    setHeroPhoto(pendingPhoto.base64);
    setHeroLoading(true);
    setPendingPhoto(null);
    if (onHeroPhoto) onHeroPhoto(pendingPhoto.base64, pendingPhoto.mimeType, name);
    setHeroName(name);
  }, [pendingPhoto, heroName, onHeroPhoto, setHeroPhoto, setHeroName]);

  const cancelHeroUpload = useCallback(() => {
    setPendingPhoto(null);
    setHeroName('');
  }, [setHeroName]);

  const removeHeroPhoto = () => {
    setHeroPhoto(null);
    setHeroLoading(false);
    setHeroName('');
    if (onHeroPhoto) onHeroPhoto(null, null);
  };

  const openMenu = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
    }
    setStyleOpen(true);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!styleOpen) return;
    const onClickOutside = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setStyleOpen(false);
      }
    };
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [styleOpen]);

  const { recording, startRecording, stopRecording } = useVoiceCapture({
    onAudioCaptured: (base64, mimeType) => {
      if (onSendAudio) onSendAudio(base64, mimeType);
    },
  });

  const isDisabled = !connected || (!generating && quotaCooldown > 0);
  const isSteerMode = generating && connected;

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    if (isSteerMode) {
      onSteer?.(text);
      setInputValue('');
      return;
    }
    if (isDisabled || generating) return;
    onSend(text, { artStyle, sceneCount, language });
    setInputValue('');
  };
  const hasText = inputValue.trim().length > 0;

  // Styles list for dropdown — only trend styles when hero mode active
  const dropdownStyles = heroActive ? ART_STYLES.filter(s => s.trend) : ART_STYLES;

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
                {dropdownStyles.map(({ key, label }) => (
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

          {/* Hero mode: photo upload / loading / badge with name */}
          <div className="control-hero-upload flex items-center px-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            {heroLoading && !heroActive ? (
              /* Loading state — photo uploaded, analysis in progress */
              <div
                className="flex items-center gap-1.5 p-1 px-2 rounded-lg"
                style={{
                  background: 'var(--accent-primary-soft)',
                  border: '1px solid var(--glass-border-accent)',
                  animation: 'heroShimmer 1.5s ease-in-out infinite',
                }}
              >
                {heroPhoto && (
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--accent-primary)', opacity: 0.7, flexShrink: 0 }}>
                    <img src={heroPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid var(--glass-border-accent)',
                    borderTopColor: 'var(--accent-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyzing...</span>
              </div>
            ) : heroActive || heroPhoto ? (
              /* Active hero pill: circular avatar + name + X */
              <div
                className="flex items-center"
                style={{
                  background: 'var(--accent-primary-soft)',
                  border: '1px solid var(--glass-border-accent)',
                  borderRadius: '9999px',
                  padding: '2px 10px 2px 2px',
                  gap: '6px',
                }}
              >
                {heroPhoto ? (
                  <div
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      overflow: 'hidden', border: '1.5px solid var(--accent-primary)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                    onClick={() => fileInputRef.current.click()}
                    title="Change photo"
                  >
                    <img src={heroPhoto} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0,
                    }}
                    onClick={() => fileInputRef.current.click()}
                    title="Add photo"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: 'var(--accent-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {heroName || heroMode?.heroName || 'Hero'}
                </span>
                <button
                  type="button"
                  onClick={removeHeroPhoto}
                  className="flex items-center justify-center hover:opacity-70"
                  style={{ color: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0, padding: 0, border: 'none', background: 'none' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Default: camera button to upload photo */
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="flex items-center justify-center p-2 rounded-lg transition-all"
                title="Add your photo for Hero Mode"
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            )}
          </div>

          {/* Usage counter pill — hidden for pro (limit is effectively unlimited) */}
          {usage && usage.limits?.generations_today > 0 && usage.usage?.tier !== 'pro' && (
            <div
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                color: (usage.usage?.generations_today || 0) >= usage.limits.generations_today * 0.9
                  ? 'var(--status-error, #ef4444)'
                  : 'var(--text-muted)',
                background: 'var(--glass-bg-strong)',
                border: '1px solid var(--glass-border)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="Generations used today"
            >
              {usage.usage?.generations_today || 0}/{usage.limits.generations_today}
            </div>
          )}

          <div className="control-input-divider" />

          <textarea
            ref={(el) => {
              // Auto-grow: reset height then set to scrollHeight
              if (el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }
            }}
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
            placeholder={recording ? 'Listening... click mic to stop' : quotaCooldown > 0 ? `Image quota exhausted - retry in ${quotaCooldown}s` : generating ? 'Steer the story... (e.g. make it scarier)' : (PLACEHOLDERS[language] || PLACEHOLDERS.English)}
            disabled={isDisabled && !isSteerMode}
            className="flex-1 bg-transparent outline-none control-input"
            style={{ color: 'var(--text-primary)', resize: 'none', overflowY: 'auto' }}
            rows={1}
          />

          {/* Single morphing action button: mic → send → steer/spinner */}
          {generating && hasText ? (
            <button
              type="submit"
              className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
              style={{
                background: 'var(--accent-secondary)',
                color: 'var(--text-inverse)',
                border: '1px solid var(--accent-secondary)',
                boxShadow: 'var(--shadow-glow-secondary)',
                cursor: 'pointer',
              }}
              title="Steer the story"
            >
              {/* Compass icon */}
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </button>
          ) : generating ? (
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
                opacity: (isDisabled || generating) ? 0.3 : 1,
                cursor: (isDisabled || generating) ? 'not-allowed' : 'pointer',
              }}
              title={recording ? 'Click to stop' : 'Click to record'}
              onClick={!(isDisabled || generating) ? (recording ? stopRecording : startRecording) : undefined}
              disabled={isDisabled || generating}
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

      </form>

      {/* Hero name dialog — appears after file selection */}
      {pendingPhoto && createPortal(
        <div
          className="hero-dialog-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'heroDialogFadeIn 0.2s ease-out',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) cancelHeroUpload(); }}
        >
          <div
            style={{
              background: 'linear-gradient(165deg, color-mix(in srgb, var(--bg-primary) 95%, var(--accent-primary) 5%), var(--bg-primary))',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, var(--glass-border) 75%)',
              borderRadius: '20px',
              padding: '32px 28px 24px',
              width: '340px',
              maxWidth: '90vw',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4), 0 0 40px var(--accent-primary-glow, rgba(255,165,0,0.08))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              animation: 'heroDialogSlideUp 0.25s ease-out',
            }}
          >
            {/* Photo with animated glow ring */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: '-4px', borderRadius: '18px',
                background: 'conic-gradient(from 0deg, var(--accent-primary), var(--accent-secondary, #a855f7), var(--accent-primary))',
                animation: 'heroRingSpin 3s linear infinite',
                opacity: 0.8,
              }} />
              <div style={{
                position: 'relative',
                width: '96px', height: '96px', borderRadius: '14px',
                overflow: 'hidden', border: '3px solid var(--bg-primary)',
              }}>
                <img src={pendingPhoto.base64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>

            {/* Title + subtitle */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{
                fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)',
                margin: '0 0 6px 0', letterSpacing: '-0.01em',
              }}>
                Who is the hero?
              </h3>
              <p style={{
                fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5,
              }}>
                Your character&apos;s name for the story
              </p>
            </div>

            {/* Name input */}
            <div style={{ width: '100%', position: 'relative' }}>
              <input
                ref={nameDialogInputRef}
                type="text"
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && heroName.trim()) confirmHeroUpload(); if (e.key === 'Escape') cancelHeroUpload(); }}
                maxLength={24}
                placeholder="Enter a name..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: `1.5px solid ${heroName.trim() ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  background: 'var(--glass-bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '15px',
                  fontWeight: 600,
                  outline: 'none',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: heroName.trim() ? '0 0 12px var(--accent-primary-glow, rgba(255,165,0,0.15))' : 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={cancelHeroUpload}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmHeroUpload}
                disabled={!heroName.trim()}
                style={{
                  flex: 1.5, padding: '10px 14px', borderRadius: '12px',
                  border: 'none',
                  background: heroName.trim()
                    ? 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 80%, var(--accent-secondary, #a855f7) 20%))'
                    : 'var(--glass-bg-strong)',
                  color: heroName.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em',
                  cursor: heroName.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: heroName.trim() ? '0 4px 16px var(--accent-primary-glow, rgba(255,165,0,0.3))' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Begin Hero Mode
              </button>
            </div>
          </div>
        </div>,
        document.body
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
        @keyframes heroShimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes heroDialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes heroDialogSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes heroRingSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
