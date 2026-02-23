import { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { SceneActionsContext } from './contexts/SceneActionsContext';
import useWebSocket from './hooks/useWebSocket';
import useActiveStory from './hooks/useActiveStory';
import useStoryActions from './hooks/useStoryActions';
import useBookManager from './hooks/useBookManager';
import useAppEffects from './hooks/useAppEffects';
import { API_URL } from './utils/storyHelpers';

import Logo from './components/Logo';
import StoryCanvas from './components/StoryCanvas';
import AppHeader from './components/AppHeader';
import CompleteBookDialog from './components/dialogs/CompleteBookDialog';
import DirectorPanel from './components/DirectorPanel';
import BookDetailsPage from './components/BookDetailsPage';
import ControlBar from './components/ControlBar';
import LibraryPage from './components/LibraryPage';
import ExplorePage from './components/ExplorePage';
import ReadingMode from './components/ReadingMode';
import SplashScreen from './components/SplashScreen';
import AuthScreen, { VerifyEmailScreen } from './components/AuthScreen';
import SubscriptionPage from './components/SubscriptionPage';
import AdminDashboard from './components/AdminDashboard';
import TermsPage from './components/TermsPage';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, idToken, loading: authLoading, isAdmin, emailVerified, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, resendVerification, reloadUser, signOut } = useAuth();

  const urlStoryMatch = location.pathname.match(/^\/story\/(.+?)(?:\/|$)/);
  const urlStoryId = urlStoryMatch ? urlStoryMatch[1] : null;
  const urlBookMatch = location.pathname.match(/^\/book\/(.+?)(?:\/|$)/);
  const isBookRoute = !!urlBookMatch;

  const { initialState, storyLoading, clearState } = useActiveStory(user, urlStoryId);
  const { addToast } = useToast();
  const { connected, scenes, generating, userPrompt, error, directorData, generations, storyId, quotaCooldown, sceneBusy, bookMeta, portraits, portraitsLoading, usage, send, sendAudio, sendSceneAction, reset, load, setStoryDeletedHandler, setControlBarInputHandler } = useWebSocket(idToken, initialState, addToast);
  const { theme, toggleTheme } = useTheme();
  const [directorOpen, setDirectorOpen] = useState(true);
  const [controlBarInput, setControlBarInput] = useState('');
  useEffect(() => { setControlBarInputHandler(setControlBarInput); }, [setControlBarInputHandler]);
  const [artStyle, setArtStyle] = useState('cinematic');
  const [languageRaw, setLanguageRaw] = useState('English');
  const setLanguage = useCallback((lang) => { setLanguageRaw(lang); setControlBarInput(''); }, []);
  const language = languageRaw;
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const {
    saving, saved, generatingCover,
    storyStatus, setStoryStatus,
    showCompleteDialog, setShowCompleteDialog, completing,
    isPublished, setIsPublished,
    setShowPublishDialog,
    autoSaveCurrent, handleSave, handleComplete,
    resetSaved,
  } = useStoryActions({ storyId, scenes, generations, bookMeta, idToken, addToast, user });
  const [readingMode, setReadingMode] = useState(false);
  const [bookmarkedSceneIndex, setBookmarkedSceneIndex] = useState(null);

  const isLibrary = location.pathname === '/library';
  const isExplore = location.pathname === '/explore';
  const isBookPage = location.pathname.startsWith('/book/');
  const [viewingReadOnly, setViewingReadOnly] = useState(false);

  // Per-scene action callbacks
  const handleRegenImage = useCallback((sceneNumber, sceneText) => {
    if (!storyId || generating) return;
    sendSceneAction('regen_image', { scene_number: sceneNumber, scene_text: sceneText, story_id: storyId });
  }, [storyId, generating, sendSceneAction]);

  const handleRegenScene = useCallback((sceneNumber, sceneText) => {
    if (!storyId || generating) return;
    const allScenes = scenes.map((s) => ({ scene_number: s.scene_number, text: s.text }));
    sendSceneAction('regen_scene', { scene_number: sceneNumber, scene_text: sceneText, all_scenes: allScenes, story_id: storyId, language });
  }, [storyId, generating, scenes, sendSceneAction, language]);

  const handleDeleteScene = useCallback((sceneNumber) => {
    if (!storyId || generating) return;
    sendSceneAction('delete_scene', { scene_number: sceneNumber, story_id: storyId });
  }, [storyId, generating, sendSceneAction]);

  const canRegen = usage?.limits?.scene_regens_today > 0;
  const sceneActionsValue = useMemo(() => ({
    regenImage: handleRegenImage,
    regenScene: handleRegenScene,
    deleteScene: handleDeleteScene,
    sceneBusy,
    isReadOnly: viewingReadOnly || storyStatus === 'completed',
    canRegen,
  }), [handleRegenImage, handleRegenScene, handleDeleteScene, sceneBusy, viewingReadOnly, storyStatus, canRegen]);

  // Track whether scenes were ever populated (hydration completed at least once)
  const [hasBeenPopulated, setHasBeenPopulated] = useState(false);
  useEffect(() => {
    if (scenes.length > 0) setHasBeenPopulated(true);
  }, [scenes.length]);
  useEffect(() => {
    if (initialState === null || initialState === undefined) setHasBeenPopulated(false);
  }, [initialState]);

  const isHydrating = !!(initialState?.scenes?.length) && scenes.length === 0 && !generating && !hasBeenPopulated;

  const handleGenreClick = useCallback((prompt) => {
    setControlBarInput(prompt);
  }, []);

  const { handleOpenBook, handleOpenPublicBook } = useBookManager({
    storyId, autoSaveCurrent, reset, load, navigate, user,
    setStoryStatus, setIsPublished, setArtStyle, setLanguage, setViewingReadOnly,
  });

  // All side effects extracted to useAppEffects
  useAppEffects({
    storyId, urlStoryId, isLibrary, isExplore, navigate,
    scenes, generating, initialState, idToken,
    bookMeta, setBookmarkedSceneIndex, resetSaved,
    setStoryStatus, setIsPublished, setArtStyle, setLanguage,
    setViewingReadOnly, setStoryDeletedHandler,
    clearState, addToast,
    location,
  });

  // Derive per-scene image tier info for DirectorPanel
  const imageTiers = useMemo(() =>
    scenes
      .filter(s => s.image_url && s.image_url !== 'error')
      .map(s => ({ scene: s.scene_number, tier: s.image_tier || 1 })),
    [scenes]
  );

  const spreadPromptsMemo = useMemo(() => {
    if (!currentSceneNumber || !scenes.length) return { left: userPrompt, right: null };
    const leftScene = scenes[currentSceneNumber - 1];
    const rightScene = scenes[currentSceneNumber];
    return {
      left: leftScene?.prompt || userPrompt,
      right: rightScene?.prompt || null,
    };
  }, [currentSceneNumber, scenes, userPrompt]);

  // Public story viewing for unauthenticated users
  const [publicStory, setPublicStory] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);
  useEffect(() => {
    if (!authLoading && !user && urlStoryId && !publicStory && !publicLoading) {
      setPublicLoading(true);
      fetch(`${API_URL}/api/public/stories/${urlStoryId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPublicStory(data); })
        .catch(() => {})
        .finally(() => setPublicLoading(false));
    }
  }, [authLoading, user, urlStoryId, publicStory, publicLoading]);

  // Loading splash
  const showSplash = authLoading || (user && storyLoading) || (user && initialState === undefined) || (user && isHydrating);

  if (showSplash) {
    const splashMessage = !user
      ? 'Connecting...'
      : isHydrating
        ? 'Resuming your story...'
        : 'Loading your story...';
    return <SplashScreen message={splashMessage} />;
  }

  // Not signed in - show public story, book details, or sign-in screen
  if (!user) {
    // Guest viewing a book details page - no login required
    if (isBookRoute) {
      return (
        <div className="h-screen flex flex-col relative overflow-hidden">
          <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-gradient)' }}>
            <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
            <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
            <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
          </div>
          <header className="relative z-20 flex items-center justify-between header-bar" style={{ background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-glass)' }}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Logo size="compact" />
            </div>
            <div className="flex items-center header-actions">
              <button onClick={() => navigate('/')} className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-glow-primary)' }}>
                Sign in to create
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden relative z-10">
            <Routes>
              <Route path="/book/:storyId" element={<BookDetailsPage user={null} />} />
            </Routes>
          </div>
        </div>
      );
    }

    if (publicStory) {
      return (
        <div className="h-screen flex flex-col relative overflow-hidden">
          <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-gradient)' }}>
            <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
            <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
            <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
          </div>
          <header className="relative z-20 flex items-center justify-between header-bar" style={{ background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-glass)' }}>
            <Logo size="compact" />
            <div className="flex items-center header-actions">
              {publicStory.scenes.length > 0 && (
                <button
                  onClick={() => setReadingMode(true)}
                  className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', backdropFilter: 'var(--glass-blur)' }}
                >
                  Read
                </button>
              )}
              <button onClick={() => navigate('/')} className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-glow-primary)' }}>
                Sign in to create
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden relative z-10">
            <div className="flex-1 relative flex flex-col">
              <StoryCanvas scenes={publicStory.scenes} generating={false} userPrompt={null} error={null} onGenreClick={() => {}} onPageChange={() => {}} storyId={publicStory.storyId} displayPrompt={null} spreadPrompts={{ left: null, right: null }} />
            </div>
          </div>
          {readingMode && publicStory.scenes.length > 0 && (
            <ReadingMode scenes={publicStory.scenes} storyId={publicStory.storyId} onExit={() => setReadingMode(false)} />
          )}
        </div>
      );
    }
    // Terms page accessible without login
    if (location.pathname === '/terms') {
      return <TermsPage />;
    }

    return <AuthScreen onSignInWithGoogle={signInWithGoogle} onSignInWithEmail={signInWithEmail} onSignUpWithEmail={signUpWithEmail} onResetPassword={resetPassword} />;
  }

  // Email not verified - show verification screen
  if (!emailVerified) {
    return <VerifyEmailScreen email={user.email} onResend={resendVerification} onReload={reloadUser} onSignOut={signOut} />;
  }

  // Admin-only: show just the admin dashboard
  if (isAdmin) {
    return (
      <div className="h-screen flex flex-col relative overflow-hidden">
        <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-gradient)' }}>
          <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
          <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
          <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
        </div>
        <AppHeader
          navigate={navigate} theme={theme} toggleTheme={toggleTheme}
          user={user} signOut={signOut} isAdmin={isAdmin}
          userTier={usage?.usage?.tier || 'free'}
        />
        <div className="flex flex-1 overflow-hidden relative z-10">
          <AdminDashboard idToken={idToken} addToast={addToast} />
        </div>
      </div>
    );
  }

  // Derive per-scene director data
  const activeDirectorData = (() => {
    if (generating) return directorData;
    if (currentSceneNumber && generations.length) {
      const batch = generations.find(g => g.sceneNumbers.includes(currentSceneNumber));
      if (batch?.directorData) return batch.directorData;
    }
    if (directorData) return directorData;
    for (let i = generations.length - 1; i >= 0; i--) {
      if (generations[i].directorData) return generations[i].directorData;
    }
    return null;
  })();

  const activeBatchSceneNumbers = (() => {
    if (generating || !currentSceneNumber || !generations.length) return null;
    const batch = generations.find(g => g.sceneNumbers.includes(currentSceneNumber));
    return batch?.sceneNumbers || null;
  })();

  const activeBatchSceneTitles = (() => {
    if (!activeBatchSceneNumbers || !scenes.length) return null;
    return activeBatchSceneNumbers.map(num => {
      const sc = scenes.find(s => s.scene_number === num);
      return sc?.scene_title || null;
    });
  })();

  const spreadPrompts = spreadPromptsMemo;
  const displayPrompt = spreadPrompts.left;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <AppHeader
        navigate={navigate} storyId={storyId} connected={connected}
        viewingReadOnly={viewingReadOnly} setViewingReadOnly={setViewingReadOnly} reset={reset}
        isLibrary={isLibrary} isExplore={isExplore} isBookPage={isBookPage}
        scenes={scenes} generating={generating}
        autoSaveCurrent={autoSaveCurrent} clearState={clearState}
        setStoryStatus={setStoryStatus} setIsPublished={setIsPublished} setArtStyle={setArtStyle} setLanguage={setLanguage} setBookmarkedSceneIndex={setBookmarkedSceneIndex}
        saving={saving} saved={saved} generatingCover={generatingCover} handleSave={handleSave}
        storyStatus={storyStatus} setShowCompleteDialog={setShowCompleteDialog}
        isPublished={isPublished} setShowPublishDialog={setShowPublishDialog}
        setReadingMode={setReadingMode}
        idToken={idToken} addToast={addToast}
        directorOpen={directorOpen} setDirectorOpen={setDirectorOpen}
        theme={theme} toggleTheme={toggleTheme}
        user={user} signOut={signOut}
        isAdmin={isAdmin}
        userTier={usage?.usage?.tier || 'free'}
      />

      <Routes>
        <Route
          path="/library"
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <LibraryPage user={user} onOpenBook={handleOpenBook} bookMeta={bookMeta} activeStoryId={storyId} onActiveStoryDeleted={() => { clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setLanguage('English'); setBookmarkedSceneIndex(null); navigate('/'); }} onNewStory={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setLanguage('English'); setBookmarkedSceneIndex(null); navigate('/'); }} />
            </div>
          }
        />
        <Route
          path="/explore"
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <ExplorePage user={user} onOpenBook={handleOpenPublicBook} />
            </div>
          }
        />
        <Route
          path="/book/:storyId"
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <BookDetailsPage user={user} setAppIsPublished={setIsPublished} onOpenBook={handleOpenBook} onOpenPublicBook={handleOpenPublicBook} />
            </div>
          }
        />
        <Route
          path="/subscription"
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <SubscriptionPage idToken={idToken} addToast={addToast} />
            </div>
          }
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/admin"
          element={
            isAdmin ? (
              <div className="flex flex-1 overflow-hidden relative z-10">
                <AdminDashboard idToken={idToken} addToast={addToast} />
              </div>
            ) : (
              <div className="flex flex-1 overflow-hidden relative z-10">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
                  Access denied
                </div>
              </div>
            )
          }
        />
        {['/story/:storyId', '*'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <SceneActionsContext.Provider value={sceneActionsValue}>
                <div className="flex flex-1 overflow-hidden relative z-10">
                  <div className="flex-1 relative flex flex-col">
                    <StoryCanvas key={storyId || 'new'} scenes={scenes} generating={generating} userPrompt={userPrompt} error={error} onGenreClick={handleGenreClick} onPageChange={setCurrentSceneNumber} storyId={storyId} displayPrompt={viewingReadOnly ? null : displayPrompt} spreadPrompts={viewingReadOnly ? null : spreadPrompts} bookmarkPage={bookmarkedSceneIndex !== null ? bookmarkedSceneIndex + 1 : null} language={language} />
                    {!viewingReadOnly && storyStatus !== 'completed' && (
                      <ControlBar onSend={(text, opts) => { if (scenes.length === 0) addToast(`Language set to ${language} - can't be changed for this story`, 'info'); send(text, opts); }} onSendAudio={(b64, mime) => { if (scenes.length === 0) addToast(`Language set to ${language} - can't be changed for this story`, 'info'); sendAudio(b64, mime); }} connected={connected} generating={generating} quotaCooldown={quotaCooldown} inputValue={controlBarInput} setInputValue={setControlBarInput} artStyle={artStyle} setArtStyle={setArtStyle} language={language} setLanguage={setLanguage} languageLocked={scenes.length > 0} usage={usage} />
                    )}
                  </div>
                  {directorOpen && !viewingReadOnly && <DirectorPanel data={activeDirectorData} generating={generating} sceneNumbers={activeBatchSceneNumbers} sceneTitles={activeBatchSceneTitles} imageTiers={imageTiers} portraits={portraits} portraitsLoading={portraitsLoading} language={language} />}
                </div>
              </SceneActionsContext.Provider>
            }
          />
        ))}
      </Routes>

      {readingMode && scenes.length > 0 && (
        <ReadingMode scenes={scenes} storyId={storyId} idToken={idToken} onExit={() => setReadingMode(false)} onBookmarkChange={setBookmarkedSceneIndex} />
      )}

      {showCompleteDialog && (
        <CompleteBookDialog completing={completing} onClose={() => setShowCompleteDialog(false)} onComplete={handleComplete} />
      )}
    </div>
  );
}
