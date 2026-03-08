import { useState, useEffect } from 'react';
import useUsage from '../hooks/useUsage';
import Tooltip from './Tooltip';
import { API_URL } from '../utils/storyHelpers';
import './SubscriptionPage.css';

function useResetCountdown() {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function calc() {
      const now = new Date();
      const midnight = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
      ));
      const diff = midnight - now;
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setRemaining(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return remaining;
}

/* ── Daily counters (reset at midnight UTC) ── */
const DAILY_FIELDS = [
  {
    key: 'generations_today',
    label: 'Generations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    key: 'scene_regens_today',
    label: 'Regens',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
  },
  {
    key: 'pdf_exports_today',
    label: 'PDF Exports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
];

/* ── Lifetime counters (never reset) ── */
const LIFETIME_FIELDS = [
  {
    key: 'active_stories',
    label: 'Active Stories',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    key: 'published_stories',
    label: 'Published',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

function barColor(pct) {
  if (pct >= 90) return 'var(--status-error, #ef4444)';
  if (pct >= 60) return 'var(--status-warning, #f59e0b)';
  return 'var(--status-success, #22c55e)';
}

function UsageCell({ icon, label, current, max }) {
  const unlimited = max >= 999;
  const pct = unlimited ? Math.min((current / 50) * 100, 100) : (max > 0 ? Math.min((current / max) * 100, 100) : 0);
  return (
    <div className="usage-cell">
      <div className="usage-cell-top">
        <div className="usage-cell-icon">{icon}</div>
        <span className="usage-cell-label">{label}</span>
      </div>
      <div className="usage-cell-bottom">
        <div className="usage-cell-track">
          <div className="usage-cell-fill" style={{ width: `${Math.max(pct, 3)}%`, background: unlimited ? 'var(--status-success, #22c55e)' : barColor(pct) }} />
        </div>
        <span className="usage-cell-count">{unlimited ? `${current} / ∞` : `${current}/${max}`}</span>
      </div>
    </div>
  );
}

const CheckIcon = ({ className }) => (
  <svg className={`sub-check ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function SubscriptionPage({ idToken, addToast }) {
  const { data, loading } = useUsage(idToken);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const resetIn = useResetCountdown();

  const usage = data?.usage || {};
  const limits = data?.limits || {};
  const currentTier = usage.tier || 'free';

  const handleNotify = async () => {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/usage/pro-waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      addToast?.("You're on the list!", 'success');
    } catch {
      addToast?.('Failed to join waitlist', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sub-container">
      {/* Hero */}
      <div className="sub-hero">
        <div className="sub-hero-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <h1>Subscription & Usage</h1>
        <p>Track your daily usage and manage your Reveria plan</p>
      </div>

      <div className="sub-content">
        {/* Daily usage card */}
        <div className="sub-usage-card">
          <div className="sub-usage-header">
            <span className="sub-usage-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Daily Usage
            </span>
            <Tooltip label="Time until daily limits reset (midnight UTC)">
            <span className="sub-reset-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Resets in {resetIn}
            </span>
            </Tooltip>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading usage data...</p>
          ) : (
            <div className="sub-usage-grid">
              {DAILY_FIELDS.map(({ key, label, icon }) => (
                <UsageCell
                  key={key}
                  icon={icon}
                  label={label}
                  current={usage[key] || 0}
                  max={limits[key] || 0}
                />
              ))}
            </div>
          )}
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
            <span className="sub-lifetime-pill">
              Lifetime
            </span>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading...</p>
          ) : (
            <div className="sub-usage-grid sub-usage-grid--2">
              {LIFETIME_FIELDS.map(({ key, label, icon }) => (
                <UsageCell
                  key={key}
                  icon={icon}
                  label={label}
                  current={usage[key] || 0}
                  max={limits[key] || 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="sub-plans sub-plans--3">
          {/* Free */}
          <div className={`sub-plan${currentTier === 'free' ? '' : ' sub-plan--dim'}`}>
            <div className="sub-plan-header">
              <div className="sub-plan-icon sub-plan-icon--free">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              {currentTier === 'free' && <span className="sub-plan-badge sub-plan-badge--current">Current Plan</span>}
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

          {/* Standard */}
          <div className={`sub-plan sub-plan--standard${currentTier === 'standard' ? '' : currentTier === 'pro' ? ' sub-plan--dim' : ''}`}>
            <div className="sub-plan-header">
              <div className="sub-plan-icon sub-plan-icon--standard">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span className={`sub-plan-badge ${currentTier === 'standard' ? 'sub-plan-badge--current' : 'sub-plan-badge--soon'}`}>
                {currentTier === 'standard' ? 'Current Plan' : 'Coming Soon'}
              </span>
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

          {/* Pro */}
          <div className={`sub-plan sub-plan--pro`}>
            <div className="sub-plan-header">
              <div className="sub-plan-icon sub-plan-icon--pro">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <span className={`sub-plan-badge ${currentTier === 'pro' ? 'sub-plan-badge--current' : 'sub-plan-badge--soon'}`}>
                {currentTier === 'pro' ? 'Current Plan' : 'Coming Soon'}
              </span>
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
            {currentTier !== 'pro' && <div className="sub-email-section">
              {submitted ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, textAlign: 'center' }}>
                  You're on the waitlist!
                </p>
              ) : (
                <div className="sub-email-group">
                  <input
                    type="email"
                    className="sub-email-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNotify()}
                  />
                  <button className="sub-email-btn" onClick={handleNotify} disabled={submitting || !email.trim()}>
                    {submitting ? '...' : 'Notify Me'}
                  </button>
                </div>
              )}
            </div>}
          </div>
        </div>

        <p className="sub-footer">Daily limits reset at midnight UTC - next reset in {resetIn}</p>
      </div>
    </div>
  );
}
