import { useState, useRef, useEffect, useCallback } from 'react';

export default function HeroUploadDialog({ onUpload, onClose, nudgeTimeout = 20000, onNudge }) {
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const fileRef = useRef(null);
  const nameRef = useRef(null);
  const nudgeTimerRef = useRef(null);
  const nudgeFiredRef = useRef(false);

  // Nudge Director if user hasn't uploaded after timeout
  useEffect(() => {
    if (nudgeTimeout > 0 && onNudge && !nudgeFiredRef.current) {
      nudgeTimerRef.current = setTimeout(() => {
        nudgeFiredRef.current = true;
        onNudge();
      }, nudgeTimeout);
    }
    return () => { if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current); };
  }, [nudgeTimeout, onNudge]);

  // Focus name input when photo selected
  useEffect(() => {
    if (photo && nameRef.current) nameRef.current.focus();
  }, [photo]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhoto({ base64: reader.result, mimeType: file.type });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirm = useCallback(() => {
    if (!photo) return;
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    onUpload(photo.base64, photo.mimeType, name.trim());
    onClose();
  }, [photo, name, onUpload, onClose]);

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
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.25s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(165deg, color-mix(in srgb, var(--bg-primary) 94%, var(--accent-primary) 6%), var(--bg-primary))',
          border: '1px solid var(--glass-border)',
          borderRadius: '1.25rem',
          padding: '2rem 1.75rem 1.5rem',
          maxWidth: '380px',
          width: '90%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 40px var(--accent-primary-glow)',
          animation: 'dialogPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input type="file" ref={fileRef} onChange={handleFile} accept="image/*" style={{ display: 'none' }} />

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🛡️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            Become the hero
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Upload your photo to star in the story
          </p>
        </div>

        {!photo ? (
          /* Upload area */
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              padding: '2rem 1rem',
              borderRadius: '0.75rem',
              border: '2px dashed var(--glass-border-accent)',
              background: 'var(--glass-bg)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              marginBottom: '1rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.background = 'var(--accent-primary-soft)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
              e.currentTarget.style.background = 'var(--glass-bg)';
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
              Tap to upload your photo
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Max 5 MB
            </span>
          </button>
        ) : (
          /* Photo preview + name input */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {/* Photo preview */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '14px',
                  background: 'conic-gradient(from 0deg, var(--accent-primary), var(--accent-secondary, #a855f7), var(--accent-primary))',
                  animation: 'heroRingSpin 3s linear infinite', opacity: 0.7,
                }} />
                <div style={{
                  position: 'relative', width: '72px', height: '72px', borderRadius: '12px',
                  overflow: 'hidden', border: '2px solid var(--bg-primary)',
                }}>
                  <img src={photo.base64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
              {/* Name input */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem', textAlign: 'left' }}>
                  Hero name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleConfirm(); }}
                  maxLength={24}
                  placeholder="Enter a name..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.6rem',
                    border: `1.5px solid ${name.trim() ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                    background: 'var(--glass-bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPhoto(null)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.6rem',
                  border: '1px solid var(--glass-border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Change
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                style={{
                  flex: 2, padding: '0.6rem', borderRadius: '0.6rem',
                  border: 'none',
                  background: name.trim()
                    ? 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 80%, var(--accent-secondary) 20%))'
                    : 'var(--glass-bg-strong)',
                  color: name.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.8rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: name.trim() ? '0 4px 16px var(--accent-primary-glow)' : 'none',
                }}
              >
                Begin Hero Mode
              </button>
            </div>
          </>
        )}

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px',
            }}
          >
            Skip — use text bar instead
          </button>
        </div>
      </div>

      <style>{`
        @keyframes heroRingSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
