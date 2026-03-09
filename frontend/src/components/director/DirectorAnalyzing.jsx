import { CARDS, ShimmerVisual } from './directorUtils.jsx';

export default function DirectorAnalyzing() {
  return (
    <>
      {/* Scanning indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        padding: '10px 14px',
        borderRadius: '12px',
        background: 'var(--accent-secondary-soft)',
        border: '1px solid var(--glass-border-secondary)',
        animation: 'analyzePulse 2s ease-in-out infinite',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scanEye 2.5s ease-in-out infinite',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="8" width="20" height="14" rx="2" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            <path d="M2 8L4 3h16l2 5" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            <line x1="7" y1="3" x2="8.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="12" y1="3" x2="13.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="17" y1="3" x2="18.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
          </svg>
        </div>
        <div>
          <p style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-secondary)',
            marginBottom: '2px',
          }}>
            Analyzing story
          </p>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'var(--accent-secondary)',
                animation: `analyzeDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton cards with pill-shaped shimmers */}
      {CARDS.map(({ key, label, icon }, cardIndex) => (
        <div
          key={key}
          className="mb-3 p-3.5 rounded-xl"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            animation: `analyzeCardIn 0.5s ease-out ${cardIndex * 0.12}s both`,
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div style={{
              animation: `analyzeIconPulse 2s ease-in-out ${cardIndex * 0.3}s infinite`,
            }}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={icon} />
              </svg>
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </span>
          </div>
          <ShimmerVisual />
        </div>
      ))}
    </>
  );
}
