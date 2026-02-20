import { useState, useRef, useEffect } from 'react';

export default function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const photoURL = user?.photoURL;
  const displayName = user?.displayName || 'User';
  const email = user?.email || '';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full flex items-center justify-center transition-all overflow-hidden cursor-pointer"
        style={{
          width: '32px',
          height: '32px',
          background: photoURL ? 'transparent' : 'var(--accent-primary)',
          border: `2px solid ${open ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
          boxShadow: open ? 'var(--shadow-glow-primary)' : 'none',
        }}
        title={displayName}
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl overflow-hidden"
          style={{
            width: '260px',
            background: 'var(--dropdown-bg)',
            backdropFilter: 'var(--glass-blur-strong)',
            WebkitBackdropFilter: 'var(--glass-blur-strong)',
            border: '1px solid var(--glass-border-hover)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 9999,
          }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 p-4">
            <div
              className="rounded-full overflow-hidden flex-shrink-0"
              style={{ width: '40px', height: '40px', background: 'var(--accent-primary)' }}
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                    {initials}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p
                className="font-semibold truncate"
                style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}
              >
                {displayName}
              </p>
              <p
                className="truncate"
                style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
              >
                {email}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--glass-border)' }} />

          {/* Sign out */}
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ fontSize: '0.85rem' }}>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
