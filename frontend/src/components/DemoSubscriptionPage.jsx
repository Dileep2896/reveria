import { useEffect, useRef } from 'react';
import './SubscriptionPage.css';

const CheckIcon = ({ className }) => (
  <svg className={`sub-check ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function UsageCell({ icon, label, current, max }) {
  const unlimited = max >= 999;
  const pct = unlimited ? Math.min((current / 50) * 100, 100) : (max > 0 ? Math.min((current / max) * 100, 100) : 0);
  const barColor = unlimited ? 'var(--status-success, #22c55e)' : pct >= 90 ? 'var(--status-error, #ef4444)' : pct >= 60 ? 'var(--status-warning, #f59e0b)' : 'var(--status-success, #22c55e)';
  return (
    <div className="usage-cell">
      <div className="usage-cell-top">
        <div className="usage-cell-icon">{icon}</div>
        <span className="usage-cell-label">{label}</span>
      </div>
      <div className="usage-cell-bottom">
        <div className="usage-cell-track">
          <div className="usage-cell-fill" style={{ width: `${Math.max(pct, 3)}%`, background: barColor }} />
        </div>
        <span className="usage-cell-count">{unlimited ? `${current} / ∞` : `${current}/${max}`}</span>
      </div>
    </div>
  );
}

export default function DemoSubscriptionPage({ autoScroll = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    const el = containerRef.current;
    // Find scrollable parent (the fixed overlay)
    const scrollParent = el.closest('[style*="overflow"]') || el.parentElement;
    if (!scrollParent) return;

    const duration = 2800;
    let start = null;
    let rafId;

    function step(timestamp) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      scrollParent.scrollTop = eased * (scrollParent.scrollHeight - scrollParent.clientHeight);
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    const timeout = setTimeout(() => { rafId = requestAnimationFrame(step); }, 300);
    return () => { clearTimeout(timeout); if (rafId) cancelAnimationFrame(rafId); };
  }, [autoScroll]);

  return (
    <div className="sub-container sub-container--compact" ref={containerRef}>
      {/* Top row: Hero (left) + Usage cards (right) */}
      <div className="sub-top-row">
        <div className="sub-hero sub-hero--compact">
          <div className="sub-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <h1>Subscription & Usage</h1>
          <p>Track your daily usage and manage your Reveria plan</p>
        </div>

        <div className="sub-usage-col">
          {/* Daily usage card */}
          <div className="sub-usage-card">
            <div className="sub-usage-header">
              <span className="sub-usage-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Daily Usage
              </span>
              <span className="sub-reset-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Resets in 17:24:52
              </span>
            </div>
            <div className="sub-usage-grid">
              <UsageCell
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>}
                label="Generations" current={0} max={5}
              />
              <UsageCell
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
                label="Regens" current={0} max={0}
              />
              <UsageCell
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>}
                label="PDF Exports" current={0} max={2}
              />
            </div>
          </div>

          {/* Lifetime usage card */}
          <div className="sub-usage-card">
            <div className="sub-usage-header">
              <span className="sub-usage-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Account Limits
              </span>
              <span className="sub-lifetime-pill">Lifetime</span>
            </div>
            <div className="sub-usage-grid sub-usage-grid--2">
              <UsageCell
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
                label="Active Stories" current={0} max={5}
              />
              <UsageCell
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>}
                label="Published" current={0} max={2}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: 3 plan cards side by side */}
      <div className="sub-plans sub-plans--3">
        <div className="sub-plan">
          <div className="sub-plan-header">
            <div className="sub-plan-icon sub-plan-icon--free">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="sub-plan-badge sub-plan-badge--current">Current Plan</span>
          </div>
          <h3 className="sub-plan-name">Free</h3>
          <p className="sub-plan-price">$0 / month</p>
          <div className="sub-plan-divider" />
          <ul className="sub-plan-features">
            <li><CheckIcon className="sub-check--free" />5 active stories</li>
            <li><CheckIcon className="sub-check--free" />5 generations / day</li>
            <li><CheckIcon className="sub-check--free" />2 PDF exports / day</li>
            <li><CheckIcon className="sub-check--free" />2 published stories</li>
          </ul>
        </div>

        <div className="sub-plan sub-plan--standard">
          <div className="sub-plan-header">
            <div className="sub-plan-icon sub-plan-icon--standard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="sub-plan-badge sub-plan-badge--soon">Coming Soon</span>
          </div>
          <h3 className="sub-plan-name">Standard</h3>
          <p className="sub-plan-price">$4.99 / month</p>
          <div className="sub-plan-divider" />
          <ul className="sub-plan-features">
            <li><CheckIcon className="sub-check--standard" />8 active stories</li>
            <li><CheckIcon className="sub-check--standard" />10 generations / day</li>
            <li><CheckIcon className="sub-check--standard" />6 scene regens / day</li>
            <li><CheckIcon className="sub-check--standard" />4 PDF exports / day</li>
            <li><CheckIcon className="sub-check--standard" />4 published stories</li>
          </ul>
        </div>

        <div className="sub-plan sub-plan--pro">
          <div className="sub-plan-header">
            <div className="sub-plan-icon sub-plan-icon--pro">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <span className="sub-plan-badge sub-plan-badge--soon">Coming Soon</span>
          </div>
          <h3 className="sub-plan-name">Pro</h3>
          <p className="sub-plan-price">$9.99 / month</p>
          <div className="sub-plan-divider" />
          <ul className="sub-plan-features">
            <li><CheckIcon className="sub-check--pro" />Unlimited stories</li>
            <li><CheckIcon className="sub-check--pro" />Unlimited generations</li>
            <li><CheckIcon className="sub-check--pro" />Unlimited regens</li>
            <li><CheckIcon className="sub-check--pro" />Unlimited PDF exports</li>
            <li><CheckIcon className="sub-check--pro" />Unlimited publishing</li>
            <li><CheckIcon className="sub-check--pro" />Priority image generation</li>
          </ul>
          <div className="sub-email-section">
            <div className="sub-email-group">
              <input type="email" className="sub-email-input" placeholder="your@email.com" readOnly />
              <button className="sub-email-btn" disabled>Notify Me</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
