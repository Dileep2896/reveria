import Logo from './Logo';

export default function SplashScreen({ message }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
      </div>

      <div
        className="flex flex-col items-center"
        style={{ animation: 'fadeIn 0.6s ease-out' }}
      >
        <Logo size="full" />

        {/* Progress bar */}
        <div
          style={{
            width: '120px',
            height: '2px',
            borderRadius: '1px',
            background: 'var(--glass-border)',
            overflow: 'hidden',
            marginTop: '1.5rem',
          }}
        >
          <div
            style={{
              width: '40%',
              height: '100%',
              borderRadius: '1px',
              background: 'var(--accent-primary)',
              boxShadow: '0 0 8px var(--accent-primary-glow)',
              animation: 'loadingSlide 1.4s ease-in-out infinite',
            }}
          />
        </div>

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            marginTop: '1rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            animation: 'loadingTextPulse 2s ease-in-out infinite',
          }}
        >
          {message}
        </p>
      </div>

      <style>{`
        @keyframes loadingSlide {
          0% { transform: translateX(-120px); }
          100% { transform: translateX(300px); }
        }
        @keyframes loadingTextPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
