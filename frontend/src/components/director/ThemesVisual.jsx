const palette = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899'];

export default function ThemesVisual({ themes, summary }) {
  if (!themes || !themes.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {themes.map((theme, i) => {
          const color = palette[i % palette.length];
          const pct = Math.round((theme.confidence || 0) * 100);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
              }}
            >
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color,
                minWidth: '60px',
                flexShrink: 0,
              }}>
                {theme.name}
              </span>
              <div style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: 'var(--glass-border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '3px',
                  background: color,
                  width: `${pct}%`,
                  animation: `healthBarGrow 0.6s ease ${i * 0.1}s both`,
                }} />
              </div>
              <span style={{
                fontSize: '9px',
                fontWeight: 600,
                color,
                width: '28px',
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
