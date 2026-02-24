export default function CompleteBookDialog({ completing, onClose, onComplete }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.25s ease',
      }}
      onClick={() => !completing && onClose()}
    >
      <div
        style={{
          background: 'var(--glass-bg-strong)',
          border: '1px solid var(--glass-border)',
          borderRadius: '1.25rem',
          padding: '2.5rem 2.5rem 2rem',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 40px var(--accent-primary-glow)',
          animation: 'dialogPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon with glow ring */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          margin: '0 auto 1.25rem',
          borderRadius: '50%',
          background: 'var(--accent-primary-soft)',
          border: '1px solid var(--glass-border-accent)',
          boxShadow: '0 0 24px var(--accent-primary-glow)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.4rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 0.6rem',
          letterSpacing: '0.01em',
        }}>
          Complete This Book?
        </h3>

        {/* Decorative divider */}
        <div style={{
          width: '40px',
          height: '1px',
          margin: '0 auto 0.8rem',
          background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
          opacity: 0.5,
        }} />

        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          margin: '0 auto 2rem',
          maxWidth: '300px',
        }}>
          Once completed, this book will be permanently locked. You won't be able to add, edit, or regenerate scenes. You can then publish it to Explore for others to read.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            disabled={completing}
            className="transition-all"
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '999px',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: completing ? 'default' : 'pointer',
              opacity: completing ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onComplete}
            disabled={completing}
            className="transition-all"
            style={{
              padding: '0.6rem 1.75rem',
              borderRadius: '999px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: completing ? 'default' : 'pointer',
              opacity: completing ? 0.7 : 1,
              boxShadow: '0 4px 16px var(--accent-primary-glow)',
            }}
          >
            {completing ? 'Completing...' : 'Complete'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dialogPop {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
