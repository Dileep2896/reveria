import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: '1.2rem',
          fontFamily: 'var(--font-body, system-ui, sans-serif)',
          color: 'var(--text-primary, #e2d6c6)',
          background: 'var(--bg-gradient, #0f0a1a)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Background orbs */}
          <div style={{ position: 'absolute', inset: 0, background: 'var(--orb-1, none)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--orb-2, none)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--orb-3, none)', pointerEvents: 'none' }} />

          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem',
          }}>
            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--glass-bg-strong, rgba(255,255,255,0.06))',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '0.25rem',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #c9a44a)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 style={{
              fontSize: '1.6rem', margin: 0, fontWeight: 700,
              fontFamily: 'var(--font-display, Georgia, serif)',
              color: 'var(--text-primary, #e2d6c6)',
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: 'var(--text-muted, #a0a0b0)', margin: 0,
              fontSize: '0.95rem', maxWidth: 340, textAlign: 'center', lineHeight: 1.5,
            }}>
              An unexpected error occurred. Refreshing the page should fix it.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '999px',
                  border: 'none', cursor: 'pointer',
                  background: 'var(--accent-primary, #c9a44a)', color: '#fff',
                  fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                  boxShadow: 'var(--shadow-glow-primary, 0 0 12px rgba(201,164,74,0.3))',
                  transition: 'all 0.2s ease',
                }}
              >
                Reload page
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '999px',
                  border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                  cursor: 'pointer',
                  background: 'var(--glass-bg, rgba(255,255,255,0.03))',
                  color: 'var(--text-secondary, #c0b8a8)',
                  fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s ease',
                }}
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
