import { useState } from 'react';
import { createPortal } from 'react-dom';

const CARDS = [
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
function normalizeCardData(key, content) {
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
function hasVisualFields(key, content) {
  if (!content) return false;
  if (key === 'narrative_arc') return !!(content.stage || content.pacing);
  if (key === 'characters') return !!(content.list && content.list.length);
  if (key === 'tension') return !!(content.levels && content.levels.length);
  if (key === 'visual_style') return !!(content.tags && content.tags.length);
  return false;
}

/* ── Pill helper ── */
function Pill({ label, color, bg, title }) {
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
function ChevronToggle({ expanded, onClick }) {
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

/* ── Visual sub-components ── */

function NarrativeArcVisual({ stage, pacing, summary }) {
  const stages = ['exposition', 'rising_action', 'climax', 'falling_action', 'resolution'];
  const stageIndex = stages.indexOf(stage);
  const pacingColors = { slow: '#22c55e', moderate: '#f59e0b', fast: '#ef4444' };

  // Arc curve points (80x28 SVG)
  const arcPath = 'M4 24 Q20 24 30 14 Q40 2 40 2 Q40 2 50 14 Q60 24 76 24';
  // Dot positions along arc for each stage
  const dotPositions = [
    { x: 10, y: 22 },   // exposition
    { x: 24, y: 14 },   // rising_action
    { x: 40, y: 4 },    // climax
    { x: 56, y: 14 },   // falling_action
    { x: 70, y: 22 },   // resolution
  ];
  const dot = stageIndex >= 0 ? dotPositions[stageIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Mini arc SVG */}
        {stageIndex >= 0 && (
          <svg width="80" height="28" viewBox="0 0 80 28" style={{ flexShrink: 0 }}>
            <path
              d={arcPath}
              fill="none"
              stroke="var(--glass-border)"
              strokeWidth="1.5"
            />
            {dot && (
              <circle
                cx={dot.x}
                cy={dot.y}
                r="4"
                fill="var(--accent-secondary)"
                stroke="var(--bg-primary)"
                strokeWidth="1.5"
              >
                <animate attributeName="r" values="3.5;4.5;3.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        )}
        {/* Stage pill */}
        {stage && (
          <Pill
            label={stage.replace('_', ' ')}
            color="var(--accent-secondary)"
            bg="var(--accent-secondary-soft)"
          />
        )}
        {/* Pacing pill */}
        {pacing && (
          <Pill
            label={pacing}
            color={pacingColors[pacing] || 'var(--text-secondary)'}
            bg={`${pacingColors[pacing] || 'var(--text-muted)'}18`}
          />
        )}
      </div>
    </div>
  );
}

function CharactersVisual({ list, summary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}
      {list && list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {list.map((char, i) => (
            <Pill
              key={i}
              label={`${char.name}${char.role ? ' \u00b7 ' + char.role : ''}`}
              title={char.trait || ''}
              color="var(--text-primary)"
              bg="var(--glass-bg)"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TensionVisual({ levels, trend, summary, sceneNumbers }) {
  const trendIcons = { rising: '\u2197', falling: '\u2198', steady: '\u2192', volatile: '\u2195' };
  const trendColors = { rising: '#ef4444', falling: '#22c55e', steady: '#f59e0b', volatile: '#a855f7' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {summary && (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, flex: '1 1 auto' }}>
            {summary}
          </p>
        )}
        {trend && (
          <Pill
            label={`${trendIcons[trend] || ''} ${trend}`}
            color={trendColors[trend] || 'var(--text-secondary)'}
            bg={`${trendColors[trend] || 'var(--text-muted)'}18`}
          />
        )}
      </div>
      <TensionBars tension={{ levels }} sceneNumbers={sceneNumbers} />
    </div>
  );
}

function VisualStyleVisual({ tags, mood, summary }) {
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

/* ── TensionBars (kept from original) ── */

function TensionBars({ tension, sceneNumbers }) {
  if (!tension?.levels?.length) return null;
  const max = 10;
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: tension.levels.length <= 4 ? '12px' : '6px',
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
              width: tension.levels.length <= 4 ? '36px' : '24px',
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: tension.levels.length <= 4 ? '12px' : '6px',
        marginTop: '4px',
        padding: '0 4px',
      }}>
        {tension.levels.map((_, i) => (
          <span
            key={i}
            style={{
              width: tension.levels.length <= 4 ? '36px' : '24px',
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
    </div>
  );
}

/* ── Shimmer components ── */

function ShimmerVisual() {
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

/* ── Help Modal ── */

function DirectorHelpModal({ onClose }) {
  const sections = [
    {
      title: 'Narrative Arc',
      icon: 'M3 12h18',
      content: (
        <>
          <p>Tracks where your story sits on a classic 5-stage arc:</p>
          <ul>
            <li><strong>Exposition</strong> — Setting the scene, introducing characters</li>
            <li><strong>Rising Action</strong> — Conflict develops, stakes increase</li>
            <li><strong>Climax</strong> — Peak tension, the turning point</li>
            <li><strong>Falling Action</strong> — Consequences unfold</li>
            <li><strong>Resolution</strong> — Story wraps up</li>
          </ul>
          <p>The <strong>mini arc curve</strong> shows your position visually. The <strong>pacing pill</strong> indicates tempo:</p>
          <div className="dh-inline-pills">
            <span className="dh-pill" style={{ color: '#22c55e', borderColor: '#22c55e33' }}>slow</span>
            <span className="dh-pill-desc">deliberate, atmospheric</span>
            <span className="dh-pill" style={{ color: '#f59e0b', borderColor: '#f59e0b33' }}>moderate</span>
            <span className="dh-pill-desc">balanced progression</span>
            <span className="dh-pill" style={{ color: '#ef4444', borderColor: '#ef444433' }}>fast</span>
            <span className="dh-pill-desc">rapid, action-driven</span>
          </div>
        </>
      ),
    },
    {
      title: 'Characters',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
      content: (
        <>
          <p>Character pills show each character extracted from your story. Each pill displays:</p>
          <ul>
            <li><strong>Name</strong> — the character's name</li>
            <li><strong>Role</strong> — their story function (protagonist, antagonist, mentor, etc.)</li>
          </ul>
          <p>Hover a pill to see the character's key trait.</p>
        </>
      ),
    },
    {
      title: 'Tension',
      icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
      content: (
        <>
          <p>Bar chart showing tension per scene on a <strong>1–10 scale</strong>. Higher bars and warmer colors = more intensity. <strong>S1, S2…</strong> = Scene 1, Scene 2.</p>
          <p>The <strong>trend arrow</strong> summarizes how tension changes:</p>
          <div className="dh-inline-pills">
            <span className="dh-pill" style={{ color: '#ef4444', borderColor: '#ef444433' }}>↗ rising</span>
            <span className="dh-pill-desc">escalating</span>
            <span className="dh-pill" style={{ color: '#22c55e', borderColor: '#22c55e33' }}>↘ falling</span>
            <span className="dh-pill-desc">decreasing</span>
            <span className="dh-pill" style={{ color: '#f59e0b', borderColor: '#f59e0b33' }}>→ steady</span>
            <span className="dh-pill-desc">consistent</span>
            <span className="dh-pill" style={{ color: '#a855f7', borderColor: '#a855f733' }}>↕ volatile</span>
            <span className="dh-pill-desc">dramatic swings</span>
          </div>
        </>
      ),
    },
    {
      title: 'Visual Style',
      icon: 'M12 2L2 7l10 5 10-5-10-5z',
      content: (
        <>
          <p>Reflects the art direction of your story's illustrations.</p>
          <ul>
            <li><strong>Mood</strong> — emotional atmosphere (peaceful, mysterious, tense…)</li>
            <li><strong>Style tags</strong> — artistic descriptors guiding visual generation</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Illustrations',
      icon: null,
      content: (
        <>
          <p>Quality tier achieved per scene. The AI tries the best quality first and falls back if blocked:</p>
          <div className="dh-tier-list">
            <div className="dh-tier-row">
              <span className="dh-tier-dot" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e80' }} />
              <strong>Tier 1</strong>
              <span>Full scene with characters</span>
            </div>
            <div className="dh-tier-row">
              <span className="dh-tier-dot" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b80' }} />
              <strong>Tier 2</strong>
              <span>Setting only, no characters (safety filter)</span>
            </div>
            <div className="dh-tier-row">
              <span className="dh-tier-dot" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef444480' }} />
              <strong>Tier 3</strong>
              <span>Atmospheric landscape (last resort)</span>
            </div>
          </div>
          <p><strong>S1, S2…</strong> = Scene 1, Scene 2, etc.</p>
        </>
      ),
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'helpOverlayIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '72%',
          maxWidth: '900px',
          maxHeight: '85vh',
          borderRadius: '24px',
          background: 'var(--glass-bg-strong)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 60px var(--shadow-glow-secondary, rgba(168,85,247,0.08))',
          animation: 'dialogPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '22px 28px 18px',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-secondary-soft)',
            border: '1px solid var(--glass-border-secondary)',
            boxShadow: 'var(--shadow-glow-secondary)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.01em',
            }}>
              Director Guide
            </h3>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              margin: '2px 0 0',
            }}>
              Understanding the story analysis cards
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--glass-bg-strong)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--glass-bg)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="dh-scroll" style={{
          overflowY: 'auto',
          padding: '20px 28px 28px',
        }}>
          <style>{`
            .dh-scroll { scrollbar-width: thin; scrollbar-color: var(--glass-border) transparent; }
            .dh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            @media (max-width: 560px) { .dh-grid { grid-template-columns: 1fr; } }
            .dh-card {
              padding: 16px 18px;
              border-radius: 14px;
              background: var(--glass-bg);
              border: 1px solid var(--glass-border);
            }
            .dh-card-full { grid-column: 1 / -1; }
            .dh-card-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--glass-border);
            }
            .dh-card-title {
              font-size: 10px;
              font-weight: 700;
              color: var(--accent-secondary);
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .dh-body { font-size: 12px; line-height: 1.65; color: var(--text-secondary); }
            .dh-body p { margin: 0 0 8px 0; }
            .dh-body p:last-child { margin-bottom: 0; }
            .dh-body ul { margin: 4px 0 8px 0; padding-left: 16px; }
            .dh-body li { margin-bottom: 4px; }
            .dh-body strong { color: var(--text-primary); }
            .dh-inline-pills {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 4px 6px;
              margin: 6px 0 4px;
            }
            .dh-pill {
              display: inline-flex;
              font-size: 10px;
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 9999px;
              border: 1px solid;
              background: transparent;
            }
            .dh-pill-desc {
              font-size: 11px;
              color: var(--text-muted);
              margin-right: 4px;
            }
            .dh-tier-list {
              display: flex;
              flex-direction: column;
              gap: 6px;
              margin: 8px 0;
            }
            .dh-tier-row {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
              color: var(--text-secondary);
            }
            .dh-tier-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .dh-tier-row strong {
              color: var(--text-primary);
              font-size: 11px;
              white-space: nowrap;
            }
          `}</style>

          <div className="dh-grid">
            {sections.map(({ title, icon, content }, idx) => {
              const isWide = title === 'Narrative Arc' || title === 'Illustrations';
              return (
                <div key={title} className={`dh-card${isWide ? ' dh-card-full' : ''}`}>
                  <div className="dh-card-header">
                    {title === 'Illustrations' ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={icon} />
                      </svg>
                    )}
                    <span className="dh-card-title">{title}</span>
                  </div>
                  <div className="dh-body">
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Illustrations tier card ── */

const TIER_META = {
  1: { color: '#22c55e', label: 'Full scene', dot: '#22c55e' },
  2: { color: '#f59e0b', label: 'Setting only', dot: '#f59e0b' },
  3: { color: '#ef4444', label: 'Atmospheric', dot: '#ef4444' },
};

function IllustrationsCard({ imageTiers }) {
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
      <div className="flex items-center gap-2 mb-2.5">
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
      </div>

      {/* Per-scene rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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

      {/* Summary */}
      <p style={{
        fontSize: '10px',
        color: fallbackCount === 0 ? '#22c55e' : 'var(--text-muted)',
        marginTop: '8px',
        fontWeight: 500,
      }}>
        {summary}
      </p>
    </div>
  );
}

/* ── Main panel ── */

export default function DirectorPanel({ data, generating, sceneNumbers, imageTiers }) {
  const isAnalyzing = generating && !data;
  const [expandedCards, setExpandedCards] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      className="director-panel overflow-y-auto flex-shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
        backdropFilter: 'var(--glass-blur-strong)',
        WebkitBackdropFilter: 'var(--glass-blur-strong)',
        borderLeft: '1px solid var(--glass-border)',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 py-4 flex items-center gap-2.5"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--accent-secondary-soft)',
            border: '1px solid var(--glass-border-secondary)',
            boxShadow: 'var(--shadow-glow-secondary)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--accent-secondary)', flex: 1 }}
        >
          Director
        </h2>
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Director guide"
          title="What do these cards mean?"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-secondary-soft)';
            e.currentTarget.style.color = 'var(--accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ?
        </button>
      </div>

      {helpOpen && createPortal(
        <DirectorHelpModal onClose={() => setHelpOpen(false)} />,
        document.body,
      )}

      <div className="director-body">
        {!data && !isAnalyzing ? (
          /* ── Empty state — centered illustration ── */
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
          </div>
        ) : (
          /* ── Active / Analyzing state ── */
          <>
            {isAnalyzing ? (
              /* ── Analyzing state — animated scanning ── */
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
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
            ) : (
              /* ── Data-ready state ── */
              <>
                <p
                  className="text-xs leading-relaxed mb-5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Creative analysis of the current story.
                </p>

                {CARDS.map(({ key, label, icon }) => {
                  const content = normalizeCardData(key, data?.[key]);
                  const expanded = !!expandedCards[key];
                  const showChevron = content && (hasVisualFields(key, content) || content.detail);

                  return (
                    <div
                      key={key}
                      className="mb-3 p-3.5 rounded-xl"
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        backdropFilter: 'var(--glass-blur)',
                        animation: 'fadeIn 0.4s ease',
                      }}
                    >
                      {/* Card header */}
                      <div
                        className="flex items-center gap-2 mb-2.5"
                        style={{ cursor: showChevron ? 'pointer' : 'default' }}
                        onClick={() => showChevron && toggleCard(key)}
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
                          <path d={icon} />
                        </svg>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--accent-secondary)', flex: 1 }}
                        >
                          {label}
                        </span>
                        {showChevron && (
                          <ChevronToggle
                            expanded={expanded}
                            onClick={(e) => { e.stopPropagation(); toggleCard(key); }}
                          />
                        )}
                      </div>

                      {content ? (
                        <>
                          {/* Visual summary — always visible */}
                          {hasVisualFields(key, content) ? (
                            <>
                              {key === 'narrative_arc' && (
                                <NarrativeArcVisual
                                  stage={content.stage}
                                  pacing={content.pacing}
                                  summary={content.summary}
                                />
                              )}
                              {key === 'characters' && (
                                <CharactersVisual
                                  list={content.list}
                                  summary={content.summary}
                                />
                              )}
                              {key === 'tension' && (
                                <TensionVisual
                                  levels={content.levels}
                                  trend={content.trend}
                                  summary={content.summary}
                                  sceneNumbers={sceneNumbers}
                                />
                              )}
                              {key === 'visual_style' && (
                                <VisualStyleVisual
                                  tags={content.tags}
                                  mood={content.mood}
                                  summary={content.summary}
                                />
                              )}
                            </>
                          ) : (
                            /* Old string format fallback: show detail directly */
                            <p
                              className="text-xs leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {content.detail}
                            </p>
                          )}

                          {/* Collapsible detail text */}
                          {expanded && content.detail && hasVisualFields(key, content) && (
                            <div style={{
                              marginTop: '10px',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--glass-border)',
                              animation: 'detailFadeIn 0.2s ease',
                            }}>
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: 'var(--text-muted)', margin: 0 }}
                              >
                                {content.detail}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <ShimmerVisual />
                      )}
                    </div>
                  );
                })}

                {/* Illustrations tier card — after visual_style */}
                <IllustrationsCard imageTiers={imageTiers} />
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tensionBarGrow {
          from { height: 0%; opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes directorIdlePulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes analyzePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
        @keyframes scanEye {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          25% { transform: scale(1.1); opacity: 1; }
          50% { transform: scale(1); opacity: 0.8; }
          75% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes analyzeDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes analyzeCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes analyzeIconPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes helpOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogPop {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
