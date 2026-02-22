import Logo from './Logo';
import ProfileMenu from './ProfileMenu';
import { API_URL } from '../utils/storyHelpers';

export default function AppHeader({
  navigate, storyId, connected,
  viewingReadOnly, setViewingReadOnly, reset,
  isLibrary, isExplore,
  scenes, generating,
  autoSaveCurrent, clearState,
  setStoryStatus, setIsPublished, setArtStyle, setLanguage, setBookmarkedSceneIndex,
  saving, saved, generatingCover, handleSave,
  storyStatus, setShowCompleteDialog,
  isPublished, setShowPublishDialog,
  setReadingMode,
  idToken, addToast,
  directorOpen, setDirectorOpen,
  ambient,
  theme, toggleTheme,
  user, signOut,
}) {
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
      <div onClick={() => navigate(storyId ? `/story/${storyId}` : '/')} style={{ cursor: 'pointer' }}>
        <Logo size="compact" />
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

        {/* Back to Explore — visible when viewing someone else's story read-only */}
        {viewingReadOnly && (
          <button
            onClick={() => { setViewingReadOnly(false); reset(); navigate('/explore'); }}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            Back to Explore
          </button>
        )}

        {/* New Story — only visible when there's content in story view */}
        {!isLibrary && !isExplore && !viewingReadOnly && scenes.length > 0 && !generating && (
          <button
            onClick={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setLanguage('English'); setBookmarkedSceneIndex(null); navigate('/'); }}
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

        {/* Save to Library — visible when story has 2+ scenes and not generating */}
        {!isLibrary && !isExplore && !viewingReadOnly && storyStatus !== 'completed' && scenes.length >= 2 && !generating && storyId && (
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

        {/* Complete Book — visible when story is saved */}
        {!isLibrary && !isExplore && !viewingReadOnly && storyStatus === 'saved' && scenes.length >= 2 && !generating && storyId && (
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

        {/* Publish — visible when story is completed and not yet published */}
        {!isLibrary && !isExplore && !viewingReadOnly && storyStatus === 'completed' && storyId && !isPublished && (
          <button
            onClick={() => setShowPublishDialog(true)}
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
        {/* Published badge — non-interactive */}
        {!isLibrary && !isExplore && !viewingReadOnly && storyStatus === 'completed' && storyId && isPublished && (
          <span
            className="rounded-full font-semibold uppercase tracking-wider header-btn"
            style={{
              background: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--glass-border-accent)',
              boxShadow: 'var(--shadow-glow-primary)',
            }}
          >
            Published
          </span>
        )}

        {/* Reading Mode — visible for completed/read-only stories with scenes */}
        {!isLibrary && !isExplore && (viewingReadOnly || storyStatus === 'completed') && scenes.length > 0 && !generating && (
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

        {/* PDF Export — visible when saved/completed with 2+ scenes */}
        {!isLibrary && !isExplore && !viewingReadOnly && storyId && scenes.length >= 2 && !generating && (storyStatus === 'saved' || storyStatus === 'completed') && (
          <button
            onClick={async () => {
              addToast('Generating PDF...', 'info');
              try {
                const token = idToken;
                const res = await fetch(`${API_URL}/api/stories/${storyId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
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

        {/* Share Link — visible when published */}
        {!isLibrary && !isExplore && !viewingReadOnly && isPublished && storyId && (
          <button
            onClick={() => {
              const url = `${window.location.origin}/story/${storyId}`;
              navigator.clipboard.writeText(url).then(() => addToast('Link copied!', 'success')).catch(() => addToast('Failed to copy link', 'error'));
            }}
            className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
            style={{
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            Share
          </button>
        )}

        {/* Library / Explore segmented nav */}
        <div className="header-nav-group">
          <button
            onClick={async () => {
              if (!isLibrary && storyId && scenes.length > 0 && !generating) {
                await autoSaveCurrent();
              }
              navigate(isLibrary ? (storyId ? `/story/${storyId}` : '/') : '/library');
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
              navigate(isExplore ? (storyId ? `/story/${storyId}` : '/') : '/explore');
            }}
            className={`header-nav-seg${isExplore ? ' header-nav-seg--active' : ''}`}
          >
            Explore
          </button>
        </div>

        {/* Director toggle — glass pill */}
        <button
          onClick={() => setDirectorOpen(!directorOpen)}
          className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
          style={{
            background: directorOpen ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
            color: directorOpen ? 'var(--accent-secondary)' : 'var(--text-muted)',
            border: `1px solid ${directorOpen ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
            backdropFilter: 'var(--glass-blur)',
            boxShadow: directorOpen ? 'var(--shadow-glow-secondary)' : 'none',
          }}
        >
          Director
        </button>

        {/* Music toggle */}
        {ambient.playing && (
          <button
            onClick={ambient.toggle}
            className="rounded-full flex items-center justify-center transition-all header-theme-btn"
            style={{
              background: ambient.muted ? 'var(--glass-bg)' : 'var(--accent-primary-soft)',
              border: `1px solid ${ambient.muted ? 'var(--glass-border)' : 'var(--glass-border-accent)'}`,
              color: ambient.muted ? 'var(--text-muted)' : 'var(--accent-primary)',
              backdropFilter: 'var(--glass-blur)',
            }}
            title={ambient.muted ? 'Unmute music' : 'Mute music'}
          >
            {ambient.muted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        )}

        {/* Theme toggle — glass circle */}
        <button
          onClick={toggleTheme}
          className="rounded-full flex items-center justify-center transition-all header-theme-btn"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
            backdropFilter: 'var(--glass-blur)',
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Profile menu */}
        <ProfileMenu user={user} onSignOut={signOut} />
      </div>
    </header>
  );
}
