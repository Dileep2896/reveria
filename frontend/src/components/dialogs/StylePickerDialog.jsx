import { useState, useEffect, useRef, useCallback } from 'react';
import { ART_STYLE_MAP } from '../../data/artStyles';
import { getTemplate } from '../../data/templates';

const STYLE_EMOJIS = {
  cinematic: '🎬', watercolor: '🎨', comic: '💥', anime: '✨',
  ghibli: '🌿', marvel: '🦸', oil: '🖼️', pencil: '✏️',
  classic_comic: '📰', noir_comic: '🌑', superhero: '⚡', indie_comic: '🖊️',
  romantic_webtoon: '💕', action_webtoon: '🔥', slice_of_life: '☕', fantasy_webtoon: '🧙',
  epic_fantasy: '⚔️', shonen_manga: '💪', shojo_manga: '🌸', seinen_manga: '🗡️',
  chibi: '🧸', journal_sketch: '📓', ink_wash: '🖌️', impressionist: '🌻',
  ethereal: '🌙', minimalist: '◽', photorealistic: '📷', documentary: '🎥', retro_film: '📽️',
};

export default function StylePickerDialog({ template, currentStyle, onSelect, onClose, nudgeTimeout = 15000, onNudge }) {
  const styles = getTemplate(template).artStyles.map(k => ART_STYLE_MAP[k]).filter(Boolean);
  const [selected, setSelected] = useState(currentStyle);
  const nudgeTimerRef = useRef(null);
  const nudgeFiredRef = useRef(false);

  // Nudge Director if user hasn't selected after timeout
  useEffect(() => {
    if (nudgeTimeout > 0 && onNudge && !nudgeFiredRef.current) {
      nudgeTimerRef.current = setTimeout(() => {
        nudgeFiredRef.current = true;
        onNudge();
      }, nudgeTimeout);
    }
    return () => { if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current); };
  }, [nudgeTimeout, onNudge]);

  const handleSelect = useCallback((key) => {
    setSelected(key);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    onSelect(key);
    // Small delay for visual feedback before closing
    setTimeout(() => onClose(), 250);
  }, [onSelect, onClose]);

  return (
    <div
      className="style-picker-inline"
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'min(420px, 90%)',
        animation: 'slideUpFade 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(165deg, color-mix(in srgb, var(--bg-primary) 94%, var(--accent-primary) 6%), var(--bg-primary))',
          border: '1px solid var(--glass-border)',
          borderRadius: '1.25rem',
          padding: '1.25rem 1.25rem 1rem',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35), 0 0 30px var(--accent-primary-glow)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>🎨</div>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 0.15rem 0',
          }}>
            Choose your art style
          </h3>
          <p style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            Pick below or tell the Director
          </p>
        </div>

        {/* Style Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${styles.length <= 4 ? styles.length : Math.min(styles.length, 3)}, 1fr)`,
          gap: '0.4rem',
        }}>
          {styles.map(({ key, label }) => {
            const isSelected = key === selected;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.6rem 0.4rem',
                  borderRadius: '0.65rem',
                  border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  background: isSelected
                    ? 'var(--accent-primary-soft)'
                    : 'var(--glass-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 16px var(--accent-primary-glow)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
                    e.currentTarget.style.background = 'var(--glass-bg-strong)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.background = 'var(--glass-bg)';
                  }
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{STYLE_EMOJIS[key] || '🎨'}</span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {label}
                </span>
                {isSelected && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
