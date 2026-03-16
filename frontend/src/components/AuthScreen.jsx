import { useState, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import Logo from './Logo';
import './AuthScreen.css';

const FIREBASE_ERRORS = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed.',
};

function mapFirebaseError(err) {
  const code = err?.code || '';
  return FIREBASE_ERRORS[code] || err?.message || 'Something went wrong. Please try again.';
}

/* Eye icons for password toggle */
const IconEye = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

/* Input with icon */
function AuthInput({ icon, isPassword, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : props.type;

  return (
    <div className="auth-input-group">
      <div className="auth-input-icon">{icon}</div>
      <input className={`auth-input${isPassword ? ' auth-input--has-toggle' : ''}`} {...props} type={inputType} />
      {isPassword && (
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? IconEyeOff : IconEye}
        </button>
      )}
    </div>
  );
}

const IconMail = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>;
const IconLock = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconUser = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

export function VerifyEmailScreen({ email, onResend, onReload, onSignOut }) {
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try { await onResend(); setResent(true); }
    catch { /* ignore */ }
    finally { setResending(false); }
  };

  const handleCheck = async () => {
    setChecking(true);
    const verified = await onReload();
    if (!verified) setChecking(false);
  };

  return (
    <div className="auth-screen">
      <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-gradient)' }}>
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
      </div>
      <div className="auth-bg-mesh" />
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />
      <div className="auth-sparkles">
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
      </div>

      <div className="auth-card-wrapper auth-card-wrapper--verify">
        <div className="auth-card" style={{ width: '440px' }}>
          <Logo size="full" />

          <div className="verify-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 7l-10 7L2 7"/>
            </svg>
          </div>

          <h2 className="verify-title">Check your inbox</h2>
          <p className="verify-subtitle">
            We've sent a verification link to
          </p>
          <p className="verify-email">{email}</p>
          <p className="verify-hint">
            Click the link in the email, then come back here and press continue.
          </p>

          {resent && <div className="auth-success">Verification email resent!</div>}

          <button className="auth-submit" onClick={handleCheck} disabled={checking} style={{ marginTop: '1.25rem' }}>
            {checking ? 'Checking...' : "I've Verified - Continue"}
          </button>

          <button className="verify-resend" onClick={handleResend} disabled={resending}>
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>

          <div className="auth-divider-line" />

          <button className="verify-signout" onClick={onSignOut}>
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthScreen({ onSignInWithGoogle, onSignInWithEmail, onSignUpWithEmail, onResetPassword }) {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const formBodyRef = useRef(null);
  const [formHeight, setFormHeight] = useState('auto');
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    const el = formBodyRef.current;
    if (!el) return;
    if (firstRender.current) {
      // No animation on first render — just measure
      setFormHeight(el.scrollHeight + 'px');
      firstRender.current = false;
      return;
    }
    // Capture current height, then measure new content
    const prev = el.offsetHeight;
    el.style.height = 'auto';
    const next = el.scrollHeight;
    el.style.height = prev + 'px';
    // Force reflow, then animate to new height
    el.offsetHeight; // eslint-disable-line no-unused-expressions
    setFormHeight(next + 'px');
  }, [tab, error, resetSent]);

  const clearForm = () => { setError(''); setResetSent(false); };
  const switchTab = (t) => { setTab(t); setError(''); setResetSent(false); };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try { await onSignInWithEmail(email, password); }
    catch (err) { setError(mapFirebaseError(err)); }
    finally { setLoading(false); }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (!email) { setError('Please enter your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try { await onSignUpWithEmail(displayName.trim(), email, password); }
    catch (err) { setError(mapFirebaseError(err)); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    setError('');
    if (!email) { setError('Please enter your email first, then click "Forgot password?"'); return; }
    setLoading(true);
    try { await onResetPassword(email); setResetSent(true); }
    catch (err) { setError(mapFirebaseError(err)); }
    finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try { await onSignInWithGoogle(); }
    catch (err) { if (err?.code !== 'auth/popup-closed-by-user') setError(mapFirebaseError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-screen">
      {/* Layered background */}
      <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-gradient)' }}>
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
      </div>
      <div className="auth-bg-mesh" />
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      {/* Floating sparkles */}
      <div className="auth-sparkles">
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
        <div className="auth-sparkle" /><div className="auth-sparkle" />
      </div>

      {/* Split Card */}
      <div className="auth-card-wrapper">
        <div className="auth-split">
          {/* Left - Branding */}
          <div className="auth-brand">
            <div className="auth-brand-inner">
              <Logo size="full" />

              <div className="auth-brand-divider" />

              {/* Feature list */}
              <div className="auth-feature-list">
                <div className="auth-feature-item">
                  <div className="auth-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <div>
                    <p className="auth-feature-title">Gemini AI</p>
                    <p className="auth-feature-desc">Advanced narrative engine for interactive storytelling</p>
                  </div>
                </div>
                <div className="auth-feature-item">
                  <div className="auth-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                  <div>
                    <p className="auth-feature-title">Imagen 3</p>
                    <p className="auth-feature-desc">Beautiful AI-generated illustrations for every scene</p>
                  </div>
                </div>
                <div className="auth-feature-item">
                  <div className="auth-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  </div>
                  <div>
                    <p className="auth-feature-title">Live Voice</p>
                    <p className="auth-feature-desc">Speak naturally to shape your story in real time</p>
                  </div>
                </div>
                <div className="auth-feature-item">
                  <div className="auth-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  </div>
                  <div>
                    <p className="auth-feature-title">Interactive Stories</p>
                    <p className="auth-feature-desc">Publish, share, and explore community creations</p>
                  </div>
                </div>
              </div>

              {/* Competition badge */}
              <div className="auth-brand-bottom">
                <div className="auth-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Built for the Gemini Live Agent Challenge
                </div>
                <p className="auth-hashtags">#GeminiLiveAgentChallenge</p>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div className="auth-form-panel">
            {/* Mobile-only logo */}
            <div className="auth-mobile-logo">
              <Logo size="full" />
            </div>

            <h2 className="auth-form-title" key={tab}>
              {tab === 'signin' ? 'Welcome back' : 'Join Reveria'}
            </h2>
            <p className="auth-form-subtitle" key={`sub-${tab}`}>
              {tab === 'signin' ? 'Sign in to continue your stories' : 'Create an account to start writing'}
            </p>

            {/* Tabs */}
            <div className={`auth-tabs${tab === 'signup' ? ' auth-tabs--signup' : ''}`}>
              <div className="auth-tab-slider" />
              <button className={`auth-tab${tab === 'signin' ? ' auth-tab--active' : ''}`} onClick={() => switchTab('signin')}>Sign In</button>
              <button className={`auth-tab${tab === 'signup' ? ' auth-tab--active' : ''}`} onClick={() => switchTab('signup')}>Sign Up</button>
            </div>

            <div className="auth-form-body" ref={formBodyRef} style={{ height: formHeight, overflow: 'hidden', transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              {/* Error / Success */}
              {error && <div className="auth-error">{error}</div>}
              {resetSent && <div className="auth-success">Password reset email sent! Check your inbox.</div>}

              {/* Sign In Form */}
              {tab === 'signin' && (
                <form id="auth-signin" className="auth-form auth-form--animated" onSubmit={handleSignIn}>
                  <AuthInput icon={IconMail} type="email" placeholder="Email address" value={email} onChange={(e) => { setEmail(e.target.value); clearForm(); }} autoComplete="email" />
                  <AuthInput icon={IconLock} isPassword placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); clearForm(); }} autoComplete="current-password" />
                  <button type="button" className="auth-forgot" onClick={handleForgotPassword}>Forgot password?</button>
                </form>
              )}

              {/* Sign Up Form */}
              {tab === 'signup' && (
                <form id="auth-signup" className="auth-form auth-form--animated" onSubmit={handleSignUp}>
                  <AuthInput icon={IconUser} type="text" placeholder="Display Name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); clearForm(); }} autoComplete="name" />
                  <AuthInput icon={IconMail} type="email" placeholder="Email address" value={email} onChange={(e) => { setEmail(e.target.value); clearForm(); }} autoComplete="email" />
                  <AuthInput icon={IconLock} isPassword placeholder="Password (min 6 characters)" value={password} onChange={(e) => { setPassword(e.target.value); clearForm(); }} autoComplete="new-password" />
                  <AuthInput icon={IconLock} isPassword placeholder="Confirm Password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); clearForm(); }} autoComplete="new-password" />
                </form>
              )}

              {/* Shared submit button — morphs color between tabs */}
              <button
                type="submit"
                form={tab === 'signin' ? 'auth-signin' : 'auth-signup'}
                className={`auth-submit auth-submit--morph${tab === 'signup' ? ' auth-submit--signup' : ''}`}
                disabled={loading}
              >
                <span className="auth-submit-text">{tab === 'signin' ? (loading ? 'Signing in...' : 'Sign In') : (loading ? 'Creating account...' : 'Create Account')}</span>
              </button>

              {/* Or divider */}
              <div className="auth-or">or</div>

              {/* Google */}
              <button className="auth-google" onClick={handleGoogleSignIn} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              {/* Judge Quick Access */}
              <div className="auth-or">or</div>
              <button
                type="button"
                className="auth-google"
                style={{ background: 'rgba(180, 140, 255, 0.12)', border: '1px solid rgba(180, 140, 255, 0.3)' }}
                disabled={loading}
                onClick={async () => {
                  setTab('signin');
                  setLoading(true);
                  try { await onSignInWithEmail('judge@reveria.app', 'ReveriaJudge2026'); }
                  catch (err) { setError(mapFirebaseError(err)); }
                  finally { setLoading(false); }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Judge Quick Access
              </button>
              <p style={{ fontSize: '11px', color: 'rgba(200,200,210,0.5)', textAlign: 'center', marginTop: '6px' }}>
                For hackathon judges only. Others please sign up above.
              </p>

              <p className="auth-footer">
                By continuing, you agree to Reveria's{' '}
                <Link to={ROUTES.TERMS} className="auth-footer-link">Terms of Service</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
