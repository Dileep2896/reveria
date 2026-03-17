import Logo from './Logo';

export default function MobileGate() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      background: 'var(--bg-gradient, linear-gradient(135deg, #120e1c 0%, #1a1230 50%, #120e1c 100%))',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        background: 'radial-gradient(circle at 30% 20%, rgba(180,140,255,0.15) 0%, transparent 50%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.3,
        background: 'radial-gradient(circle at 70% 80%, rgba(255,168,108,0.1) 0%, transparent 50%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 16 }}>
          <Logo size={48} />
        </div>

        {/* Monitor icon */}
        <div style={{ marginBottom: 24 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(180,140,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#b48cff',
          marginBottom: 12,
          fontFamily: "'Cormorant Garamond', serif",
          letterSpacing: '0.02em',
        }}>
          Desktop Experience Only
        </h1>

        {/* Description */}
        <p style={{
          fontSize: 15,
          color: 'rgba(200,200,210,0.7)',
          lineHeight: 1.6,
          maxWidth: 340,
          margin: '0 auto 24px',
        }}>
          Reveria's interactive storybook, Director Chat voice brainstorming, and flipbook experience are designed for desktop screens.
        </p>

        <p style={{
          fontSize: 14,
          color: 'rgba(200,200,210,0.5)',
          lineHeight: 1.5,
          maxWidth: 300,
          margin: '0 auto 32px',
        }}>
          Please visit on a laptop or desktop for the full experience.
        </p>

        {/* URL pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          background: 'rgba(180,140,255,0.08)',
          border: '1px solid rgba(180,140,255,0.2)',
          borderRadius: 24,
          backdropFilter: 'blur(12px)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b48cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <span style={{ fontSize: 13, color: '#b48cff', fontWeight: 500 }}>reveria.web.app</span>
        </div>

        {/* Powered by badge */}
        <div style={{
          marginTop: 40,
          fontSize: 11,
          color: 'rgba(200,200,210,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <span style={{ color: '#b48cff' }}>&#10022;</span>
          Powered by Google Gemini
        </div>
      </div>
    </div>
  );
}
