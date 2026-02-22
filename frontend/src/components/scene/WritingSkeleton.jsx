const SKELETON_LINES = [
  { width: '92%', delay: 0 },
  { width: '100%', delay: 0.12 },
  { width: '85%', delay: 0.24 },
  { width: '96%', delay: 0.36 },
  { width: '78%', delay: 0.48 },
  { width: '100%', delay: 0.60 },
  { width: '88%', delay: 0.72 },
  { width: '45%', delay: 0.84 },
];

export default function WritingSkeleton({ scale, label = 'Crafting scene', showDropCap = true, overlay = false }) {
  const wrapStyle = overlay
    ? { position: 'absolute', inset: 0, zIndex: 5, animation: 'fadeIn 0.3s ease' }
    : { flex: '1 1 0', minHeight: 0, position: 'relative', animation: 'fadeIn 0.3s ease' };

  return (
    <div style={wrapStyle}>
      <div style={{ padding: `${2 * scale}px 0` }}>
        {/* Drop-cap skeleton */}
        {showDropCap && (
          <div style={{ float: 'left', marginRight: `${6 * scale}px`, marginTop: `${2 * scale}px` }}>
            <div style={{
              width: `${22 * scale}px`, height: `${26 * scale}px`, borderRadius: `${3 * scale}px`,
              background: 'linear-gradient(135deg, var(--accent-primary-soft), rgba(255,255,255,0.06))',
              animation: 'skeletonPulse 2s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Skeleton lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * scale}px`, paddingTop: `${2 * scale}px` }}>
          {SKELETON_LINES.map((line, i) => (
            <div key={i} style={{
              width: line.width, height: `${8 * scale}px`, borderRadius: `${4 * scale}px`,
              background: 'rgba(255,255,255,0.04)',
              position: 'relative', overflow: 'hidden',
              animation: `skeletonLineIn 0.4s ease-out ${line.delay}s both`,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 40%, var(--accent-primary-soft) 50%, rgba(255,255,255,0.08) 60%, transparent 100%)',
                animation: `shimmer 2.4s ease-in-out ${line.delay + 0.5}s infinite`,
              }} />
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: `${3 * scale}px`,
                background: 'var(--accent-primary)',
                borderRadius: `${2 * scale}px`,
                boxShadow: '0 0 8px var(--accent-primary-glow), 0 0 16px var(--accent-primary-glow)',
                animation: `typingCursor 2.8s ease-in-out ${line.delay + 0.4}s infinite`,
                opacity: 0,
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Label */}
      <div style={{
        position: 'absolute', bottom: `${16 * scale}px`, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${5 * scale}px`,
      }}>
        <svg width={10 * scale} height={10 * scale} viewBox="0 0 24 24" fill="none"
          stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.6 }}
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        <span style={{
          fontSize: `${8 * scale}px`, fontWeight: 500, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.5,
          fontFamily: "'Inter', sans-serif",
        }}>{label}</span>
      </div>
    </div>
  );
}
