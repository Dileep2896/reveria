import VoiceOrb from '../VoiceOrb';

const CTA_AMPLITUDE = () => 0.08 + Math.sin(Date.now() * 0.003) * 0.06;

export default function LiveAgentCTA({ onStartChat, disabled }) {
  return (
    <button onClick={onStartChat} className="live-agent-cta" disabled={disabled} style={disabled ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'auto' } : undefined}>
      <div className="live-agent-cta-glow" />
      <div className="live-agent-cta-content">
        <div className="live-agent-orb">
          <VoiceOrb mode="idle" getAmplitude={CTA_AMPLITUDE} size={44} />
        </div>
        <div className="live-agent-text">
          <span className="live-agent-title">Talk to Director</span>
          <span className="live-agent-subtitle">
            Brainstorm your next scene
          </span>
        </div>
      </div>
      <div className="live-agent-bottom">
        <div className="live-agent-a11y-row">
          <span className="live-agent-a11y-pill">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            Voice
          </span>
          <span className="live-agent-a11y-pill">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Text
          </span>
        </div>
        <div className="live-agent-badge">
          <span className="live-agent-dot" />
          LIVE
        </div>
      </div>
    </button>
  );
}
