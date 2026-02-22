import { useState } from 'react';
import { ChevronToggle, TIER_META } from './directorUtils.jsx';

export default function IllustrationsCard({ imageTiers }) {
  const [expanded, setExpanded] = useState(false);

  if (!imageTiers || imageTiers.length === 0) return null;

  const fallbackCount = imageTiers.filter(t => t.tier > 1).length;
  const summary = fallbackCount === 0
    ? 'All scenes at full quality'
    : `${fallbackCount} of ${imageTiers.length} scene${imageTiers.length > 1 ? 's' : ''} used fallback`;

  return (
    <div
      className="mb-3 p-3.5 rounded-xl"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        animation: 'fadeIn 0.4s ease',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--accent-secondary)', flex: 1 }}
        >
          Illustrations
        </span>
        <ChevronToggle
          expanded={expanded}
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        />
      </div>

      {/* Summary — always visible */}
      <p style={{
        fontSize: '10px',
        color: fallbackCount === 0 ? '#22c55e' : 'var(--text-muted)',
        marginTop: '6px',
        fontWeight: 500,
      }}>
        {summary}
      </p>

      {/* Per-scene rows — collapsible */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px', animation: 'fadeIn 0.3s ease' }}>
          {imageTiers.map(({ scene, tier }) => {
            const meta = TIER_META[tier] || TIER_META[1];
            return (
              <div
                key={scene}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: meta.dot,
                    boxShadow: `0 0 6px ${meta.dot}80`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  S{scene}
                </span>
                <span style={{ color: meta.color, fontWeight: 600, fontSize: '10px' }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
