const typeConfig = {
  pacing:         { color: '#f59e0b', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8' },
  character:      { color: '#a855f7', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
  world_building: { color: '#3b82f6', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  dialogue:       { color: '#22c55e', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  tension:        { color: '#ef4444', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  sensory:        { color: '#ec4899', icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' },
};

export default function DirectorsNotesVisual({ notes, summary }) {
  if (!notes || !notes.length) return null;

  const maxVisible = 3;
  const visible = notes.slice(0, maxVisible);
  const overflow = notes.length - maxVisible;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {visible.map((note, i) => {
          const cfg = typeConfig[note.type] || typeConfig.pacing;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke={cfg.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: '2px' }}
              >
                <path d={cfg.icon} />
              </svg>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: cfg.color,
                  background: `${cfg.color}15`,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  lineHeight: '14px',
                }}
              >
                S{note.scene}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {note.note}
              </span>
            </div>
          );
        })}
        {overflow > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '16px' }}>
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}
