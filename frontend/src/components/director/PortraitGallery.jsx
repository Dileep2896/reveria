export default function PortraitGallery({ portraits = [], portraitsLoading = false }) {
  if (portraits.length === 0 && !portraitsLoading) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        padding: '14px',
        animation: 'fadeIn 0.4s ease-out',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: portraits.length > 0 || portraitsLoading ? '10px' : 0 }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
            Portraits
          </span>
        </div>
        {portraitsLoading && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Generating...
          </div>
        )}
      </div>
      {portraits.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="portrait-scroll">
          {portraits.map((p, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    objectFit: 'cover', border: '2px solid var(--glass-border-accent)',
                  }}
                />
              ) : (
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'var(--accent-primary-soft)', border: '2px solid var(--glass-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)',
                }}>
                  {p.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <span className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: '60px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
