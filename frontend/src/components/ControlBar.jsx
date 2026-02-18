import { useState } from 'react';

export default function ControlBar({ onSend, connected, generating }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div
      className="p-4"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--glass-border)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex gap-3 items-center max-w-4xl mx-auto"
      >
        {/* Input container — glass */}
        <div
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
          style={{
            background: 'var(--glass-bg-input)',
            border: `1px solid ${focused ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
            boxShadow: focused ? 'var(--shadow-glow-primary)' : 'var(--shadow-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          {/* Mic button — glass circle */}
          <button
            type="button"
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--glass-border)',
            }}
            title="Voice input (coming soon)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={generating ? "Story is being crafted..." : "Describe a scenario like a mystery, an adventure, a bedtime story..."}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Send button — glass with accent */}
        <button
          type="submit"
          disabled={!connected || !input.trim() || generating}
          className="flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-30"
          style={{
            background: input.trim()
              ? 'var(--accent-primary)'
              : 'var(--glass-bg)',
            color: input.trim()
              ? 'var(--text-inverse)'
              : 'var(--text-muted)',
            border: `1px solid ${input.trim() ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
            boxShadow: input.trim() ? 'var(--shadow-glow-primary)' : 'none',
          }}
        >
          <div className="flex items-center gap-2">
            Create
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </button>
      </form>
    </div>
  );
}
