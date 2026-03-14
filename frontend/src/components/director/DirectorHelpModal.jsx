export default function DirectorHelpModal({ onClose }) {
  const sections = [
    {
      title: 'Now Viewing',
      color: 'var(--accent-secondary)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
      wide: true,
      content: (
        <>
          <p>Shows the Director's insight for the scene(s) you're currently reading.</p>
          <ul>
            <li><strong>Emoji + Scene number</strong> — visual mood marker for each scene</li>
            <li><strong>Title</strong> — the scene's name (e.g. "Moonlit Discovery")</li>
            <li><strong>Tension bar</strong> — per-scene tension on a <strong>1–10 scale</strong>. Higher = more intense.</li>
            <li><strong>Craft note</strong> — the Director's brief observation about what makes this scene work</li>
          </ul>
          <p>In two-page mode, you see both the left and right scene side-by-side. Tap to expand long notes.</p>
        </>
      ),
    },
    {
      title: 'Story Health',
      color: 'var(--accent-secondary)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      wide: true,
      content: (
        <>
          <p>Five dimensions scored <strong>0–10</strong> with a weighted average:</p>
          <div className="dh-dim-grid">
            {[
              { name: 'Pacing', desc: 'Rhythm and tempo of events', color: '#a855f7' },
              { name: 'Characters', desc: 'Development and complexity', color: '#3b82f6' },
              { name: 'World', desc: 'Setting richness and detail', color: '#3b82f6' },
              { name: 'Dialogue', desc: 'Naturalness and purpose', color: 'var(--text-muted)' },
              { name: 'Coherence', desc: 'Plot consistency and logic', color: '#ef4444' },
            ].map(d => (
              <div key={d.name} className="dh-dim-row">
                <span className="dh-dim-dot" style={{ background: d.color }} />
                <strong>{d.name}</strong>
                <span>{d.desc}</span>
              </div>
            ))}
          </div>
          <p>The header shows the overall average. Color: <span style={{ color: '#22c55e', fontWeight: 600 }}>green</span> (&ge;8), <span style={{ color: '#f59e0b', fontWeight: 600 }}>amber</span> (&ge;5), <span style={{ color: '#ef4444', fontWeight: 600 }}>red</span> (&lt;5). Click to expand/collapse the bars.</p>
        </>
      ),
    },
    {
      title: 'Characters',
      color: '#60a5fa',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      content: (
        <>
          <p>Every character extracted from your story. Each chip shows:</p>
          <div className="dh-chip-example">
            <span className="dh-chip-avatar">E</span>
            <span><strong>Name</strong> — the character's name</span>
          </div>
          <div className="dh-chip-example" style={{ marginTop: 4 }}>
            <span className="dh-chip-role-dot" />
            <span><strong>Role</strong> — story function (protagonist, keeper, mentor…)</span>
          </div>
          <p style={{ marginTop: 8 }}>Hover a chip to see additional character details.</p>
        </>
      ),
    },
    {
      title: 'Visual Style',
      color: 'var(--accent-secondary)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      ),
      content: (
        <>
          <p>Reflects the art direction of your story's illustrations.</p>
          <ul>
            <li><strong>Mood badge</strong> — overall emotional atmosphere (peaceful, mysterious, tense…)</li>
            <li><strong>Style tags</strong> — artistic descriptors like "Cinematic", "Atmospheric", "Coastal"</li>
          </ul>
          <p>Tags animate in when data arrives. Hover to highlight.</p>
        </>
      ),
    },
    {
      title: 'Themes',
      color: 'var(--amber, #ffa86c)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      content: (
        <>
          <p>Identifies 2–3 central themes from your story, shown as a vertical list with glowing accent dots.</p>
          <p>Common themes: Hope, Discovery, Loss, Redemption, Identity, Freedom, etc.</p>
        </>
      ),
    },
    {
      title: 'Emotional Arc',
      color: '#f472b6',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
      content: (
        <>
          <p>Tracks the overall emotional trajectory of your story.</p>
          <ul>
            <li><strong>Dominant emotion</strong> — primary feeling (Hope, Fear, Curiosity, Wonder…)</li>
            <li><strong>Arc shape</strong> — classic trajectory name (Rags to Riches, Man in a Hole, Icarus…)</li>
          </ul>
          <p>A brief summary describes the emotional journey from start to end.</p>
        </>
      ),
    },
    {
      title: 'Accessibility',
      color: '#22c55e',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <path d="M7 9h10M12 9v4M9 16l3-3 3 3" />
        </svg>
      ),
      content: (
        <>
          <p>The Director supports <strong>both voice and text input</strong>, making it fully accessible:</p>
          <ul>
            <li><strong>Voice mode</strong> — speak naturally to brainstorm with the Director via the Gemini Live API</li>
            <li><strong>Text mode</strong> — click the <strong>Type</strong> button to switch to text input for users who are deaf, hard of hearing, or prefer typing</li>
            <li><strong>Transcripts</strong> — all voice interactions are transcribed and shown as text in the chat thread, so nothing is lost</li>
            <li><strong>Suggest button</strong> — generates a story prompt from your conversation, usable without speaking at all</li>
          </ul>
          <p>You can seamlessly switch between voice and text at any time during a session.</p>
        </>
      ),
    },
    {
      title: 'Live Commentary',
      color: 'var(--accent-primary)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      wide: true,
      content: (
        <>
          <p>When generating via <strong>Director Chat</strong>, the Director provides real-time per-scene commentary including mood, craft notes, and a "Next Direction" suggestion for creative steering.</p>
          <p>The collapsible <strong>Live Commentary</strong> section at the bottom shows all notes with an optional audio playback button. A pulsing dot indicates active generation.</p>
          <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 0, fontStyle: 'italic' }}>Note: Live commentary only appears for Director-triggered generations, not ControlBar generations.</p>
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
              Understanding the Director analysis panel
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
              transition: border-color 0.2s ease;
            }
            .dh-card:hover {
              border-color: color-mix(in srgb, var(--accent-secondary) 20%, var(--glass-border));
            }
            .dh-card-full { grid-column: 1 / -1; }
            .dh-card-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 1px solid var(--glass-border);
            }
            .dh-card-icon {
              width: 26px;
              height: 26px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .dh-card-title {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .dh-body { font-size: 12px; line-height: 1.65; color: var(--text-secondary); }
            .dh-body p { margin: 0 0 8px 0; }
            .dh-body p:last-child { margin-bottom: 0; }
            .dh-body ul { margin: 4px 0 8px 0; padding-left: 16px; }
            .dh-body li { margin-bottom: 4px; }
            .dh-body strong { color: var(--text-primary); }
            .dh-dim-grid {
              display: flex;
              flex-direction: column;
              gap: 6px;
              margin: 8px 0 10px;
            }
            .dh-dim-row {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
              color: var(--text-secondary);
            }
            .dh-dim-row strong {
              width: 72px;
              flex-shrink: 0;
            }
            .dh-dim-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .dh-chip-example {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
              color: var(--text-secondary);
            }
            .dh-chip-avatar {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: linear-gradient(135deg, #60a5fa, #818cf8);
              color: #fff;
              font-size: 10px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .dh-chip-role-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: var(--glass-border);
              flex-shrink: 0;
              margin-left: 6px;
            }
          `}</style>

          <div className="dh-grid">
            {sections.map(({ title, icon, color, wide, content }) => (
              <div key={title} className={`dh-card${wide ? ' dh-card-full' : ''}`}>
                <div className="dh-card-header">
                  <div
                    className="dh-card-icon"
                    style={{
                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                      color: color,
                    }}
                  >
                    {icon}
                  </div>
                  <span className="dh-card-title" style={{ color }}>
                    {title}
                  </span>
                </div>
                <div className="dh-body">
                  {content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
