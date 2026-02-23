const dimensionConfig = {
  pacing:          { label: 'Pacing',     color: '#f59e0b' },
  character_depth: { label: 'Characters', color: '#a855f7' },
  world_building:  { label: 'World',      color: '#3b82f6' },
  dialogue:        { label: 'Dialogue',   color: '#22c55e' },
  coherence:       { label: 'Coherence',  color: '#ec4899' },
};

const dims = ['pacing', 'character_depth', 'world_building', 'dialogue', 'coherence'];

function avgColor(avg) {
  if (avg >= 8) return '#22c55e';
  if (avg >= 5) return '#f59e0b';
  return '#ef4444';
}

export default function StoryHealthVisual({ scores, summary }) {
  if (!scores || !Object.keys(scores).length) return null;

  const values = dims.map((d) => scores[d] || 0);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const ac = avgColor(parseFloat(avg));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: ac, lineHeight: 1 }}>
          {avg}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>/ 10 avg</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {dims.map((d, i) => {
          const cfg = dimensionConfig[d];
          const val = scores[d] || 0;
          return (
            <div
              key={d}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                width: '52px',
                flexShrink: 0,
                textAlign: 'right',
              }}>
                {cfg.label}
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
                  background: cfg.color,
                  width: `${val * 10}%`,
                  animation: `healthBarGrow 0.6s ease ${i * 0.1}s both`,
                }} />
              </div>
              <span style={{
                fontSize: '9px',
                fontWeight: 600,
                color: cfg.color,
                width: '16px',
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
