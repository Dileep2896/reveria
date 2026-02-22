import { memo } from 'react';

const EmptyPageContent = memo(({ scale = 1 }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: `${24 * scale}px`,
      textAlign: 'center',
      animation: 'fadeIn 0.6s ease-out',
    }}
  >
    {/* Decorative ornament */}
    <div
      style={{
        width: `${48 * scale}px`,
        height: `${48 * scale}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--accent-primary-soft)',
        border: '1px solid var(--glass-border-accent)',
        marginBottom: `${16 * scale}px`,
        opacity: 0.6,
      }}
    >
      <svg
        width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none"
        stroke="var(--accent-primary)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: 0.7 }}
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </div>

    <p
      style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: `${13 * scale}px`,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        opacity: 0.5,
        marginBottom: `${6 * scale}px`,
        letterSpacing: '0.02em',
      }}
    >
      The story continues...
    </p>

    {/* Ornamental divider */}
    <div
      style={{
        width: `${40 * scale}px`,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
        opacity: 0.3,
        marginBottom: `${8 * scale}px`,
      }}
    />

    <p
      style={{
        fontSize: `${9 * scale}px`,
        color: 'var(--text-muted)',
        opacity: 0.4,
        lineHeight: 1.6,
        maxWidth: `${180 * scale}px`,
      }}
    >
      Type a prompt to add more scenes to your story
    </p>
  </div>
));

export default EmptyPageContent;
