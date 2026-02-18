import SceneCard from './SceneCard';

export default function StoryCanvas({ messages, generating }) {
  const textMessages = messages.filter((m) => m.type === 'text');

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {textMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          {/* Glass hero card */}
          <div
            className="p-10 rounded-3xl flex flex-col items-center max-w-md"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-glass)',
            }}
          >
            {/* Book icon in glass circle */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{
                background: 'var(--accent-primary-soft)',
                border: '1px solid var(--glass-border-accent)',
                boxShadow: 'var(--shadow-glow-primary)',
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>

            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Begin Your Story
            </h2>
            <p
              className="text-sm text-center leading-relaxed mb-8"
              style={{ color: 'var(--text-muted)' }}
            >
              Describe a scenario like a mystery, a bedtime tale, or a
              historical event and watch it come alive with images, narration,
              and music.
            </p>

            {/* Genre pills — glass */}
            <div className="flex gap-2 flex-wrap justify-center">
              {['Mystery', 'Fantasy', 'Sci-Fi', 'Horror', "Children's"].map(
                (genre) => (
                  <span
                    key={genre}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all"
                    style={{
                      background: 'var(--glass-bg)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--glass-border)',
                      backdropFilter: 'var(--glass-blur)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-primary-soft)';
                      e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--glass-bg)';
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {genre}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {textMessages.map((msg, i) => (
            <SceneCard
              key={i}
              scene={{ scene_number: i + 1, text: msg.content }}
            />
          ))}

          {/* Loading indicator */}
          {generating && (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--accent-primary)', animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--accent-primary)', animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--accent-primary)', animationDelay: '300ms' }}
                />
              </div>
              <span
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Crafting your story...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
