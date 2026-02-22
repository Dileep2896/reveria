import { CARDS } from './directorUtils.jsx';

export default function DirectorEmptyState({ language }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2.5rem 1.5rem',
      gap: '1rem',
      minHeight: '320px',
    }}>
      {/* Icon cluster */}
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        marginBottom: '0.5rem',
      }}>
        {/* Central eye icon */}
        <div style={{
          position: 'absolute',
          inset: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'var(--accent-secondary-soft)',
          border: '1px solid var(--glass-border-secondary)',
          boxShadow: 'var(--shadow-glow-secondary)',
          animation: 'directorIdlePulse 3s ease-in-out infinite',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        {/* Orbiting dots */}
        {CARDS.map(({ icon }, i) => {
          const angle = (i * 90 - 45) * (Math.PI / 180);
          const r = 48;
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${40 + Math.cos(angle) * r - 10}px`,
              top: `${40 + Math.sin(angle) * r - 10}px`,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `directorIdlePulse 3s ease-in-out ${i * 0.4}s infinite`,
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d={icon} />
              </svg>
            </div>
          );
        })}
      </div>

      <p style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        letterSpacing: '0.02em',
      }}>
        Awaiting your story
      </p>
      <p style={{
        fontSize: '0.7rem',
        lineHeight: 1.6,
        color: 'var(--text-muted)',
        maxWidth: '200px',
      }}>
        Narrative arc, characters, tension, and visual style analysis will appear here as scenes are generated.
      </p>

      {/* Language lock warning */}
      {language && (
        <div style={{
          marginTop: '16px',
          padding: '8px 12px',
          borderRadius: '10px',
          background: 'rgba(255, 180, 50, 0.08)',
          border: '1px solid rgba(255, 180, 50, 0.2)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          maxWidth: '220px',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 180, 50, 0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{
            fontSize: '0.62rem',
            lineHeight: 1.5,
            color: 'rgba(255, 180, 50, 0.7)',
          }}>
            Language ({language}) will be locked once you start generating.
          </span>
        </div>
      )}
    </div>
  );
}
