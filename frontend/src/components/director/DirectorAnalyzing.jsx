const shimmerBg = 'var(--glass-border)';
const shimmerHighlight = 'linear-gradient(90deg, transparent 0%, var(--accent-secondary-soft, rgba(168,85,247,0.15)) 50%, transparent 100%)';

function ShimmerBar({ width = '60%', height = 6, delay = 0 }) {
  return (
    <div style={{ height, borderRadius: height / 2, width, background: shimmerBg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: shimmerHighlight, animation: `shimmerSlide 1.8s ease-in-out ${delay}s infinite` }} />
    </div>
  );
}

function ShimmerPill({ width = 48, delay = 0 }) {
  return (
    <div style={{ height: 20, borderRadius: 9999, width, background: shimmerBg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: shimmerHighlight, animation: `shimmerSlide 1.8s ease-in-out ${delay}s infinite` }} />
    </div>
  );
}

function SkeletonCard({ icon, label, children, delay = 0 }) {
  return (
    <div style={{
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 10,
      animation: `analyzeCardIn 0.5s ease-out ${delay}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, animation: `analyzeIconPulse 2s ease-in-out ${delay}s infinite` }}>
          <path d={icon} />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function DirectorAnalyzing() {
  return (
    <>
      {/* Scanning indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 14px', borderRadius: 12,
        background: 'var(--accent-secondary-soft)', border: '1px solid var(--glass-border-secondary)',
        animation: 'analyzePulse 2s ease-in-out infinite',
      }}>
        <div style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'scanEye 2.5s ease-in-out infinite' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="8" width="20" height="14" rx="2" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            <path d="M2 8L4 3h16l2 5" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            <line x1="7" y1="3" x2="8.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="12" y1="3" x2="13.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="17" y1="3" x2="18.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: 2 }}>Analyzing story</p>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-secondary)', animation: `analyzeDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Now Viewing — scene insight skeleton */}
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
        animation: 'analyzeCardIn 0.5s ease-out 0s both',
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>Now Viewing</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ShimmerPill width={24} />
          <ShimmerBar width="40%" height={8} />
        </div>
        <ShimmerBar width="70%" height={6} delay={0.1} />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tension</span>
          <ShimmerBar width="50%" height={4} delay={0.2} />
        </div>
      </div>

      {/* Story Health skeleton */}
      <SkeletonCard icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" label="Story Health" delay={0.12}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Pacing', 'Characters', 'World', 'Dialogue', 'Coherence'].map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 58, flexShrink: 0 }}>{name}</span>
              <ShimmerBar width={`${35 + Math.random() * 40}%`} height={4} delay={0.15 + i * 0.08} />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Characters skeleton */}
      <SkeletonCard icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" label="Characters" delay={0.24}>
        <ShimmerBar width="75%" height={6} delay={0.3} />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <ShimmerPill width={60} delay={0.35} />
          <ShimmerPill width={48} delay={0.4} />
        </div>
      </SkeletonCard>

      {/* Visual Style skeleton */}
      <SkeletonCard icon="M12 2L2 7l10 5 10-5-10-5z" label="Visual Style" delay={0.36}>
        <ShimmerBar width="50%" height={6} delay={0.4} />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <ShimmerPill width={56} delay={0.45} />
          <ShimmerPill width={68} delay={0.5} />
          <ShimmerPill width={44} delay={0.55} />
          <ShimmerPill width={52} delay={0.6} />
        </div>
      </SkeletonCard>

      {/* Themes skeleton */}
      <SkeletonCard icon="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" label="Themes" delay={0.48}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ShimmerPill width={50} delay={0.5} />
          <ShimmerPill width={64} delay={0.55} />
          <ShimmerPill width={42} delay={0.6} />
        </div>
      </SkeletonCard>

      {/* Emotional Arc skeleton */}
      <SkeletonCard icon="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" label="Emotional Arc" delay={0.6}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ShimmerPill width={50} delay={0.65} />
          <ShimmerPill width={70} delay={0.7} />
        </div>
        <ShimmerBar width="85%" height={6} delay={0.75} />
      </SkeletonCard>
    </>
  );
}
