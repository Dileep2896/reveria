export default function LiveAgentCTA({ onStartChat, disabled }) {
  return (
    <button onClick={onStartChat} className="live-agent-cta" disabled={disabled} style={disabled ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'auto' } : undefined}>
      <div className="live-agent-cta-glow" />
      <div className="live-agent-cta-content">
        <div className="live-agent-orb">
          <div className="live-agent-orb-ring live-agent-orb-ring-1" />
          <div className="live-agent-orb-ring live-agent-orb-ring-2" />
          <div className="live-agent-orb-inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          </div>
        </div>
        <div className="live-agent-text">
          <span className="live-agent-title">Talk to Director</span>
          <span className="live-agent-subtitle">
            Voice brainstorm your next scene
          </span>
        </div>
        <div className="live-agent-badge">
          <span className="live-agent-dot" />
          LIVE
        </div>
      </div>
      <div className="live-agent-wave">
        {[0,1,2,3,4,5,6,7].map(i => (
          <span key={i} className="live-agent-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    </button>
  );
}
