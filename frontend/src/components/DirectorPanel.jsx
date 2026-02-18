export default function DirectorPanel({ messages }) {
  const directorMessages = messages.filter((m) => m.type === 'director');

  return (
    <div
      className="w-80 overflow-y-auto flex-shrink-0"
      style={{
        background: 'var(--glass-bg)',
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
          style={{ color: 'var(--accent-secondary)' }}
        >
          Director
        </h2>
      </div>

      <div className="p-5">
        {directorMessages.length === 0 ? (
          <div>
            <p
              className="text-xs leading-relaxed mb-5"
              style={{ color: 'var(--text-muted)' }}
            >
              The agent's creative reasoning will appear here as the story
              unfolds, including narrative choices, tension arcs, and visual
              decisions.
            </p>

            {/* Glass placeholder cards */}
            {[
              { label: 'Narrative Arc', icon: 'M3 12h18' },
              { label: 'Characters', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
              { label: 'Tension', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
              { label: 'Visual Style', icon: 'M12 2L2 7l10 5 10-5-10-5z' },
            ].map(({ label, icon }) => (
              <div
                key={label}
                className="mb-3 p-3.5 rounded-xl"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'var(--glass-blur)',
                }}
              >
                <div className="flex items-center gap-2 mb-2.5">
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
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full w-2/3"
                  style={{ background: 'var(--glass-border)' }}
                />
              </div>
            ))}
          </div>
        ) : (
          directorMessages.map((msg, i) => (
            <div
              key={i}
              className="mb-3 p-3.5 rounded-xl text-sm leading-relaxed"
              style={{
                background: 'var(--accent-secondary-soft)',
                color: 'var(--accent-secondary)',
                border: '1px solid var(--glass-border-secondary)',
                backdropFilter: 'var(--glass-blur)',
              }}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
