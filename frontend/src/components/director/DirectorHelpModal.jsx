export default function DirectorHelpModal({ onClose }) {
  const sections = [
    {
      title: 'Narrative Arc',
      icon: 'M3 12h18',
      content: (
        <>
          <p>Tracks where your story sits on a classic 5-stage arc:</p>
          <ul>
            <li><strong>Exposition</strong> - Setting the scene, introducing characters</li>
            <li><strong>Rising Action</strong> - Conflict develops, stakes increase</li>
            <li><strong>Climax</strong> - Peak tension, the turning point</li>
            <li><strong>Falling Action</strong> - Consequences unfold</li>
            <li><strong>Resolution</strong> - Story wraps up</li>
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
            <li><strong>Name</strong> - the character's name</li>
            <li><strong>Role</strong> - their story function (protagonist, antagonist, mentor, etc.)</li>
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
            <li><strong>Mood</strong> - emotional atmosphere (peaceful, mysterious, tense…)</li>
            <li><strong>Style tags</strong> - artistic descriptors guiding visual generation</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Emotional Arc',
      icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z',
      content: (
        <>
          <p>Tracks the emotional valence of each scene on a <strong>-1 to +1 scale</strong> (negative to positive).</p>
          <ul>
            <li><strong>Sparkline</strong> - SVG chart showing emotional highs and lows across scenes</li>
            <li><strong>Dominant emotion</strong> - the primary feeling (joy, sadness, fear, anger, etc.)</li>
            <li><strong>Arc shape</strong> - classic emotional trajectory (Rags to Riches, Man in a Hole, Icarus, etc.)</li>
          </ul>
          <p>Green area = positive emotion, red area = negative emotion.</p>
        </>
      ),
    },
    {
      title: "Director's Notes",
      icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6',
      content: (
        <>
          <p>Per-scene craft observations from the AI director. Each note is tagged by type:</p>
          <div className="dh-inline-pills">
            <span className="dh-pill" style={{ color: '#f59e0b', borderColor: '#f59e0b33' }}>pacing</span>
            <span className="dh-pill" style={{ color: '#a855f7', borderColor: '#a855f733' }}>character</span>
            <span className="dh-pill" style={{ color: '#3b82f6', borderColor: '#3b82f633' }}>world</span>
            <span className="dh-pill" style={{ color: '#22c55e', borderColor: '#22c55e33' }}>dialogue</span>
            <span className="dh-pill" style={{ color: '#ef4444', borderColor: '#ef444433' }}>tension</span>
            <span className="dh-pill" style={{ color: '#ec4899', borderColor: '#ec489933' }}>sensory</span>
          </div>
          <p>Shows up to 3 notes with a "+N more" indicator for longer stories.</p>
        </>
      ),
    },
    {
      title: 'Story Health',
      icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      content: (
        <>
          <p>Five dimensions scored <strong>0-10</strong> with a weighted average:</p>
          <ul>
            <li><strong>Pacing</strong> - rhythm and tempo of events</li>
            <li><strong>Character Depth</strong> - development and complexity</li>
            <li><strong>World Building</strong> - setting richness and detail</li>
            <li><strong>Dialogue</strong> - naturalness and purpose</li>
            <li><strong>Coherence</strong> - plot consistency and logic</li>
          </ul>
          <p>Average color: green (&ge;8), amber (&ge;5), red (&lt;5).</p>
        </>
      ),
    },
    {
      title: 'Themes',
      icon: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
      content: (
        <>
          <p>Identifies 2-3 central themes with <strong>confidence bars</strong> (0-100%).</p>
          <p>Each theme includes a brief evidence reference from the story text. Higher confidence means stronger thematic presence.</p>
        </>
      ),
    },
    {
      title: 'Story Beats',
      icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      content: (
        <>
          <p>Maps your story against the <strong>Save the Cat</strong> 10-beat structure:</p>
          <ul>
            <li><strong style={{ color: '#22c55e' }}>Green dots</strong> - beats already hit</li>
            <li><strong style={{ color: 'var(--accent-secondary)' }}>Large accent dot</strong> - current beat</li>
            <li><strong style={{ color: '#f59e0b' }}>Dashed amber</strong> - next expected beat</li>
            <li><strong>Hollow dots</strong> - future beats</li>
          </ul>
          <p>Beats: Hook, Setup, Catalyst, Debate, Break 2, Midpoint, Crisis, All is Lost, Break 3, Finale.</p>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="8" width="20" height="14" rx="2" stroke="var(--accent-secondary)" strokeWidth="1.8" />
              <path d="M2 8L4 3h16l2 5" stroke="var(--accent-secondary)" strokeWidth="1.8" />
              <line x1="7" y1="3" x2="8.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
              <line x1="12" y1="3" x2="13.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
              <line x1="17" y1="3" x2="18.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
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
            {sections.map(({ title, icon, content }) => {
              const isWide = title === 'Narrative Arc' || title === 'Emotional Arc' || title === 'Story Beats' || title === 'Illustrations';
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
