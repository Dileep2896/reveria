export default function GeneratingContent() {
  const steps = [
    { label: 'Writing narrative', delay: 0 },
    { label: 'Generating illustrations', delay: 0.3 },
    { label: 'Composing scenes', delay: 0.6 },
  ];

  return (
    <div className="book-generating">
      <div className="book-generating-icon">
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent-primary)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </div>
      <h3 className="book-generating-title">Crafting your story...</h3>
      <p className="book-generating-subtitle">Weaving narrative and composing scenes</p>
      <div className="book-generating-steps">
        {steps.map(({ label, delay }, i) => (
          <div
            key={label}
            className="book-generating-step"
            style={{ animation: `fadeIn 0.5s ease-out ${delay}s both` }}
          >
            <div className="book-generating-dots">
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100}ms` }} />
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100 + 150}ms` }} />
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100 + 300}ms` }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
