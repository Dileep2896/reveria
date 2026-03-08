import Tooltip from '../Tooltip';

export default function TensionBars({ tension, sceneNumbers, sceneTitles }) {
  if (!tension?.levels?.length) return null;
  const max = 10;
  const count = tension.levels.length;
  const wide = count <= 4;
  const gap = wide ? '12px' : '6px';
  const barW = wide ? '36px' : '24px';
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap,
        height: '60px',
        padding: '0 4px',
      }}>
        {tension.levels.map((level, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              width: barW,
              maxWidth: '44px',
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              color: level > 7 ? 'var(--accent-primary)' : 'var(--accent-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {level}
            </span>
            <div
              style={{
                width: '100%',
                height: `${Math.max(level, 0.5) / max * 100}%`,
                background: level > 7
                  ? 'linear-gradient(to top, var(--accent-primary), var(--accent-primary-glow, var(--accent-primary)))'
                  : 'linear-gradient(to top, var(--accent-secondary), var(--accent-secondary-soft, var(--accent-secondary)))',
                borderRadius: '4px 4px 2px 2px',
                transition: 'height 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                boxShadow: level > 7 ? '0 0 8px var(--accent-primary-glow, rgba(245,158,11,0.3))' : 'none',
                animation: `tensionBarGrow 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.1}s both`,
              }}
            />
          </div>
        ))}
      </div>
      {/* Scene number labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap,
        marginTop: '4px',
        padding: '0 4px',
      }}>
        {tension.levels.map((_, i) => (
          <span
            key={i}
            style={{
              width: barW,
              maxWidth: '44px',
              textAlign: 'center',
              fontSize: '8px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            S{sceneNumbers ? sceneNumbers[i] : i + 1}
          </span>
        ))}
      </div>
      {/* Scene title labels */}
      {sceneTitles && sceneTitles.some(Boolean) && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap,
          marginTop: '1px',
          padding: '0 4px',
        }}>
          {tension.levels.map((_, i) => (
            <Tooltip key={i} label={sceneTitles[i] || ''}>
            <span
              style={{
                width: barW,
                maxWidth: '44px',
                textAlign: 'center',
                fontSize: '7px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                opacity: 0.7,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sceneTitles[i] || ''}
            </span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
