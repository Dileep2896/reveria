export const CARDS = [
  {
    key: 'narrative_arc',
    label: 'Narrative Arc',
    icon: 'M3 12h18',
  },
  {
    key: 'characters',
    label: 'Characters',
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
  },
  {
    key: 'tension',
    label: 'Tension',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
  },
  {
    key: 'visual_style',
    label: 'Visual Style',
    icon: 'M12 2L2 7l10 5 10-5-10-5z',
  },
];

/* ── Backward-compat normalizer ── */
export function normalizeCardData(key, content) {
  if (!content) return null;

  // Old string format → wrap as detail-only
  if (typeof content === 'string') {
    return { summary: '', detail: content };
  }

  // Old tension format { description, levels } → new shape
  if (key === 'tension' && content.description && !content.detail) {
    return {
      summary: content.summary || '',
      levels: content.levels || [],
      trend: content.trend || 'steady',
      detail: content.description,
    };
  }

  return content;
}

/** Returns true if the card has structured visual fields beyond just detail */
export function hasVisualFields(key, content) {
  if (!content) return false;
  if (key === 'narrative_arc') return !!(content.stage || content.pacing);
  if (key === 'characters') return !!(content.list && content.list.length);
  if (key === 'tension') return !!(content.levels && content.levels.length);
  if (key === 'visual_style') return !!(content.tags && content.tags.length);
  return false;
}

/* ── Pill helper ── */
export function Pill({ label, color, bg, title }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '2px 7px',
        borderRadius: '9999px',
        color: color || 'var(--text-secondary)',
        background: bg || 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

/* ── Chevron toggle ── */
export function ChevronToggle({ expanded, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s ease',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

/* ── Shimmer placeholder for loading state ── */
export function ShimmerVisual() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Summary placeholder */}
      <div
        style={{
          height: '6px',
          borderRadius: '3px',
          width: '60%',
          background: 'var(--glass-border)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--accent-secondary-soft, rgba(168,85,247,0.15)) 50%, transparent 100%)',
          animation: 'shimmerSlide 1.8s ease-in-out 0s infinite',
        }} />
      </div>
      {/* Pill-shaped shimmers */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[48, 56, 40].map((w, i) => (
          <div
            key={i}
            style={{
              height: '18px',
              borderRadius: '9999px',
              width: `${w}px`,
              background: 'var(--glass-border)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, var(--accent-secondary-soft, rgba(168,85,247,0.15)) 50%, transparent 100%)',
              animation: `shimmerSlide 1.8s ease-in-out ${(i + 1) * 0.15}s infinite`,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TIER_META = {
  1: { color: '#22c55e', label: 'Full scene', dot: '#22c55e' },
  2: { color: '#f59e0b', label: 'Setting only', dot: '#f59e0b' },
  3: { color: '#ef4444', label: 'Atmospheric', dot: '#ef4444' },
};
