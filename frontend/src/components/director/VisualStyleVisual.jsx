import { Pill } from './directorUtils.jsx';

export default function VisualStyleVisual({ tags, mood, summary }) {
  const moodColors = {
    peaceful: '#22c55e',
    mysterious: '#a855f7',
    tense: '#ef4444',
    chaotic: '#f97316',
    melancholic: '#6366f1',
    joyful: '#eab308',
    epic: '#ec4899',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {mood && (
          <Pill
            label={mood}
            color={moodColors[mood] || 'var(--text-secondary)'}
            bg={`${moodColors[mood] || 'var(--text-muted)'}18`}
          />
        )}
        {tags && tags.map((tag, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '9px',
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: '9999px',
              color: 'var(--text-secondary)',
              background: 'color-mix(in srgb, var(--glass-bg) 60%, transparent)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
