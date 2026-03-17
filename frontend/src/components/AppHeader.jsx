import Logo from './Logo';
import GeminiBadge from './GeminiBadge';
import ProfileMenu from './ProfileMenu';
import Tooltip from './Tooltip';
import { ROUTES } from '../routes';
import { API_URL } from '../utils/storyHelpers';

export default function AppHeader({
  navigate, storyId, connected,
  viewingReadOnly, reset,
  isLibrary, isExplore, isBookPage,
  scenes, generating,
  autoSaveCurrent, clearState,
  setStoryStatus, setIsPublished, setArtStyle, setLanguage, setBookmarkedSceneIndex,
  saving, saved, generatingCover, handleSave,
  storyStatus, setShowCompleteDialog,
  isPublished,
  setReadingMode,
  idToken, addToast,
  directorOpen, setDirectorOpen,
  onOpenSettings,
  user, signOut,
  isAdmin,
  userTier,
}) {
  // On /book/ pages, hide all story-specific action buttons
  const isNonStoryPage = isLibrary || isExplore || isBookPage;

  // Admin-only header: just logo, theme toggle, profile menu
  if (isAdmin) {
    return (
      <header
        className="relative z-20 flex items-center justify-between header-bar"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-glass)',
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <div onClick={() => navigate(ROUTES.ADMIN)} style={{ cursor: 'pointer' }}>
            <Logo size="compact" />
          </div>
          <GeminiBadge />
        </div>
        <div className="flex items-center header-actions">
          <Tooltip label="Settings">
            <button
              onClick={onOpenSettings}
              className="rounded-full flex items-center justify-center transition-all header-theme-btn"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                backdropFilter: 'var(--glass-blur)',
              }}
              aria-label="Settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </Tooltip>
          <ProfileMenu user={user} onSignOut={signOut} onNavigate={navigate} isAdmin={isAdmin} userTier={userTier} />
        </div>
      </header>
    );
  }

  return (
    <header
      className="relative z-20 flex items-center justify-between header-bar"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-glass)',
      }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <div onClick={() => navigate(storyId ? ROUTES.STORY(storyId) : ROUTES.HOME)} style={{ cursor: 'pointer' }}>
          <Logo size="compact" />
        </div>
        <GeminiBadge />
      </div>

      <div className="flex items-center header-actions">
        {/* Connection status pill */}
        <div
          className="flex items-center rounded-full header-pill"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: '6px',
              height: '6px',
              background: connected ? 'var(--status-success)' : 'var(--status-error)',
              boxShadow: connected
                ? '0 0 8px var(--status-success)'
                : '0 0 8px var(--status-error)',
            }}
          />
          <span
            className="font-medium header-pill-text"
            style={{ color: 'var(--text-muted)' }}
          >
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* New Story - only visible when there's content in story view */}
        {!isNonStoryPage && !viewingReadOnly && scenes.length > 0 && !generating && (
          <button
            onClick={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setLanguage('English'); setBookmarkedSceneIndex(null); navigate(ROUTES.NEW); }}
            disabled={saving || generatingCover}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
              opacity: saving || generatingCover ? 0.5 : 1,
              cursor: saving || generatingCover ? 'default' : 'pointer',
            }}
          >
            New Story
          </button>
        )}

        {/* Save to Library - visible when story has 2+ scenes and not generating */}
        {!isNonStoryPage && !viewingReadOnly && storyStatus !== 'completed' && scenes.length >= 2 && !generating && storyId && (
          <button
            onClick={handleSave}
            disabled={saving || saved || generatingCover}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: saved ? 'var(--accent-primary-soft)' : 'var(--glass-bg)',
              color: saved ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: `1px solid ${saved ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
              backdropFilter: 'var(--glass-blur)',
              boxShadow: saved ? 'var(--shadow-glow-primary)' : 'none',
              opacity: saving || generatingCover ? 0.6 : 1,
              cursor: saving || saved || generatingCover ? 'default' : 'pointer',
            }}
          >
            {saved ? 'Saved!' : generatingCover ? 'Generating cover...' : saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {/* Complete Book - visible when story is saved */}
        {!isNonStoryPage && !viewingReadOnly && storyStatus === 'saved' && scenes.length >= 2 && !generating && storyId && (
          <button
            onClick={() => setShowCompleteDialog(true)}
            disabled={saving || generatingCover}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
              opacity: saving || generatingCover ? 0.5 : 1,
              cursor: saving || generatingCover ? 'default' : 'pointer',
            }}
          >
            Complete Book
          </button>
        )}

        {/* Publish - navigates to Book Details pre-publish page */}
        {!isNonStoryPage && !viewingReadOnly && storyStatus === 'completed' && storyId && !isPublished && (
          <button
            onClick={() => navigate(ROUTES.BOOK(storyId), { state: { prepublish: true } })}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            Publish
          </button>
        )}
        {/* Published - "Book Page" button to navigate to /book/:storyId */}
        {!isNonStoryPage && !viewingReadOnly && storyStatus === 'completed' && storyId && isPublished && (
          <button
            onClick={() => navigate(ROUTES.BOOK(storyId))}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--glass-border-accent)',
              boxShadow: 'var(--shadow-glow-primary)',
              cursor: 'pointer',
            }}
          >
            Book Page
          </button>
        )}

        {/* Reading Mode - visible for read-only stories (from Explore) */}
        {!isNonStoryPage && viewingReadOnly && scenes.length > 0 && !generating && (
          <button
            onClick={() => setReadingMode(true)}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            Read
          </button>
        )}

        {/* PDF Export - visible only for completed stories */}
        {!isNonStoryPage && !viewingReadOnly && storyId && scenes.length >= 2 && !generating && storyStatus === 'completed' && !isPublished && (
          <button
            onClick={async () => {
              addToast('Generating PDF...', 'info');
              try {
                const token = idToken;
                const res = await fetch(`${API_URL}/api/stories/${storyId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.status === 429) { addToast('Daily PDF export limit reached - upgrade to Pro', 'error'); return; }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'story.pdf';
                a.click();
                URL.revokeObjectURL(url);
                addToast('PDF downloaded!', 'success');
              } catch (err) {
                console.error('PDF export failed:', err);
                addToast('PDF export failed', 'error');
              }
            }}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            PDF
          </button>
        )}

        {/* Library / Explore segmented nav */}
        <div className="header-nav-group">
          <button
            onClick={async () => {
              if (!isLibrary && storyId && scenes.length > 0 && !generating) {
                await autoSaveCurrent();
              }
              navigate(isLibrary ? (storyId ? ROUTES.STORY(storyId) : ROUTES.HOME) : ROUTES.LIBRARY);
            }}
            className={`header-nav-seg${isLibrary ? ' header-nav-seg--active' : ''}`}
          >
            Library
          </button>
          <button
            onClick={async () => {
              if (!isExplore && storyId && scenes.length > 0 && !generating) {
                await autoSaveCurrent();
              }
              navigate(isExplore ? (storyId ? ROUTES.STORY(storyId) : ROUTES.HOME) : ROUTES.EXPLORE);
            }}
            className={`header-nav-seg${isExplore ? ' header-nav-seg--active' : ''}`}
          >
            Explore
          </button>
        </div>

        {/* Director toggle - glass pill (hidden on non-story pages and read-only views) */}
        {!isNonStoryPage && !viewingReadOnly && (
          <button
            onClick={() => connected && setDirectorOpen(!directorOpen)}
            disabled={!connected}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: directorOpen ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
              color: directorOpen ? 'var(--accent-secondary)' : 'var(--text-muted)',
              border: `1px solid ${directorOpen ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
              backdropFilter: 'var(--glass-blur)',
              boxShadow: directorOpen ? 'var(--shadow-glow-secondary)' : 'none',
              opacity: connected ? 1 : 0.4,
              cursor: connected ? 'pointer' : 'not-allowed',
            }}
          >
            Director
          </button>
        )}

        {/* Settings gear */}
        <Tooltip label="Settings">
          <button
            onClick={onOpenSettings}
            className="rounded-full flex items-center justify-center transition-all header-theme-btn"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              backdropFilter: 'var(--glass-blur)',
            }}
            aria-label="Settings"
          >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        </Tooltip>

        {/* Profile menu */}
        <ProfileMenu user={user} onSignOut={signOut} onNavigate={navigate} isAdmin={isAdmin} userTier={userTier} />
      </div>
    </header>
  );
}
