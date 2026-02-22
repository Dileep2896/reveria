import WritingSkeleton from './WritingSkeleton';

export default function SceneComposing({ sceneNumber, displayIndex, scale = 1 }) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scene badge */}
      <div className="flex items-center gap-2" style={{ marginBottom: `${8 * scale}px`, flexShrink: 0 }}>
        <span
          className="font-bold uppercase tracking-widest rounded-full"
          style={{
            fontSize: `${9 * scale}px`,
            padding: `${3 * scale}px ${8 * scale}px`,
            background: 'var(--accent-primary-soft)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--glass-border-accent)',
          }}
        >
          Scene {displayIndex ?? sceneNumber}
        </span>
      </div>

      {/* Image skeleton area */}
      <div
        className="w-full rounded-lg relative overflow-hidden"
        style={{
          flex: '0 0 35%',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 30% 50%, var(--accent-primary-soft) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 50%, var(--accent-secondary-soft) 0%, transparent 60%)
            `,
          }}
        />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer, rgba(255,255,255,0.06)) 40%, var(--skeleton-shimmer-peak, rgba(255,255,255,0.1)) 50%, var(--skeleton-shimmer, rgba(255,255,255,0.06)) 60%, transparent 100%)',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{
              width: `${36 * scale}px`,
              height: `${36 * scale}px`,
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
              boxShadow: 'var(--shadow-glow-primary)',
              animation: 'pulse 2.5s ease-in-out infinite',
              marginBottom: `${8 * scale}px`,
            }}
          >
            <svg
              width={16 * scale} height={16 * scale} viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <span
            className="font-medium tracking-wide"
            style={{ fontSize: `${10 * scale}px`, color: 'var(--text-secondary)' }}
          >
            Painting scene
          </span>
        </div>
      </div>

      {/* Text writing skeleton */}
      <div style={{ flex: 1, position: 'relative', marginTop: `${8 * scale}px` }}>
        <WritingSkeleton scale={scale} label="Crafting scene" />
      </div>
    </div>
  );
}
