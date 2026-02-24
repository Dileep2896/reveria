import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      gap: '1.2rem',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'var(--glass-bg-strong)',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.5rem',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          <line x1="9" y1="10" x2="5" y2="10" opacity="0.4" />
          <line x1="9" y1="14" x2="5" y2="14" opacity="0.4" />
        </svg>
      </div>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: 0,
        fontFamily: 'var(--font-display, Georgia, serif)',
      }}>
        404
      </h1>
      <p style={{
        fontSize: '1.1rem',
        color: 'var(--text-secondary)',
        margin: 0,
        maxWidth: 360,
        lineHeight: 1.5,
      }}>
        This page doesn't exist in our story. Maybe it was lost between chapters.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-glow-primary)',
            transition: 'all 0.2s ease',
          }}
        >
          Write a new story
        </button>
        <button
          onClick={() => navigate('/explore')}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            background: 'var(--glass-bg)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            backdropFilter: 'var(--glass-blur)',
            transition: 'all 0.2s ease',
          }}
        >
          Explore stories
        </button>
      </div>
    </div>
  );
}
