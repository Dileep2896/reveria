const BEAT_ORDER = [
  'opening_image', 'setup', 'catalyst', 'debate', 'break_into_two',
  'midpoint', 'bad_guys_close_in', 'all_is_lost', 'break_into_three', 'finale',
];

const BEAT_LABELS = {
  opening_image: 'Hook',
  setup: 'Setup',
  catalyst: 'Cataly',
  debate: 'Debate',
  break_into_two: 'Brk 2',
  midpoint: 'Midpt',
  bad_guys_close_in: 'Crisis',
  all_is_lost: 'Lost',
  break_into_three: 'Brk 3',
  finale: 'Finale',
};

export default function BeatsVisual({ current_beat, beats_hit, next_expected, summary }) {
  if (!beats_hit || !beats_hit.length) return null;

  const hitSet = new Set(beats_hit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        minHeight: '32px',
      }}>
        {/* Connecting line */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '4px',
          right: '4px',
          height: '1px',
          background: 'var(--glass-border)',
          transform: 'translateY(-4px)',
        }} />

        {BEAT_ORDER.map((beat, i) => {
          const isCurrent = beat === current_beat;
          const isHit = hitSet.has(beat);
          const isExpected = beat === next_expected;

          let bg, border, size, shadow;
          if (isCurrent) {
            bg = 'var(--accent-secondary)';
            border = 'none';
            size = 10;
            shadow = '0 0 6px var(--accent-secondary)';
          } else if (isHit) {
            bg = '#22c55e';
            border = 'none';
            size = 7;
            shadow = '0 0 4px #22c55e80';
          } else if (isExpected) {
            bg = 'transparent';
            border = '1.5px dashed #f59e0b';
            size = 7;
            shadow = 'none';
          } else {
            bg = 'transparent';
            border = '1px solid var(--glass-border)';
            size = 6;
            shadow = 'none';
          }

          return (
            <div
              key={beat}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                zIndex: 1,
                animation: `beatDotPop 0.3s ease ${i * 0.05}s both`,
              }}
            >
              <div style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: bg,
                border,
                boxShadow: shadow,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '7px',
                color: isCurrent ? 'var(--accent-secondary)' : isHit ? '#22c55e' : 'var(--text-muted)',
                fontWeight: isCurrent ? 700 : 500,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                {BEAT_LABELS[beat]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
