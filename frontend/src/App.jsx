import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from './routes';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { SceneActionsContext } from './contexts/SceneActionsContext';
import useWebSocket from './hooks/useWebSocket';
import useActiveStory from './hooks/useActiveStory';
import useStoryActions from './hooks/useStoryActions';
import useBookManager from './hooks/useBookManager';
import useAppEffects from './hooks/useAppEffects';
import useDirectorAutoGenerate from './hooks/useDirectorAutoGenerate';
import { getTemplate } from './data/templates';
import usePublicStory from './hooks/usePublicStory';

import Logo from './components/Logo';
import StoryCanvas from './components/StoryCanvas';
import AppHeader from './components/AppHeader';
import CompleteBookDialog from './components/dialogs/CompleteBookDialog';
import StylePickerDialog from './components/dialogs/StylePickerDialog';
import HeroUploadDialog from './components/dialogs/HeroUploadDialog';
import SettingsDialog from './components/SettingsDialog';
import DirectorPanel from './components/DirectorPanel';
import BookDetailsPage from './components/BookDetailsPage';
import ControlBar from './components/ControlBar';
import LibraryPage from './components/LibraryPage';
import ExplorePage from './components/ExplorePage';
import ReadingMode from './components/ReadingMode';
import SplashScreen from './components/SplashScreen';
import DemoOverlay from './components/DemoOverlay';
import DemoConductor from './components/DemoConductor';
import AuthScreen, { VerifyEmailScreen } from './components/AuthScreen';
import SubscriptionPage from './components/SubscriptionPage';
import AdminDashboard from './components/AdminDashboard';
import TermsPage from './components/TermsPage';
import NotFoundPage from './components/NotFoundPage';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, idToken, loading: authLoading, isAdmin, emailVerified, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, resendVerification, reloadUser, signOut, getValidToken } = useAuth();

  const urlStoryMatch = location.pathname.match(/^\/story\/(.+?)(?:\/|$)/);
  const urlStoryId = urlStoryMatch ? urlStoryMatch[1] : null;
  const urlBookMatch = location.pathname.match(/^\/book\/(.+?)(?:\/|$)/);
  const isBookRoute = !!urlBookMatch;

  const isNewRoute = location.pathname.replace(/\/+$/, '') === '/new';
  const { initialState, storyLoading, clearState } = useActiveStory(user, urlStoryId, { skip: isNewRoute });
  const { addToast } = useToast();
  const { connected, scenes, generating, generationStage, userPrompt, error, directorData, directorLiveNotes, generations, storyId, quotaCooldown, sceneBusy, bookMeta, usage, heroMode, send, sendSteer: _sendSteer, sendAudio, sendHeroPhoto, sendSceneAction, reset, load, setStoryDeletedHandler, setControlBarInputHandler, setLanguageDetectedHandler, setNavigateHandler, setAudioChunkHandler, setAudioDoneHandler, setArtStyleHandler, directorChatActive, directorChatMessages, directorChatLoading, directorChatPrompt, directorAutoGenerate, setDirectorAutoGenerate, cancelDirectorAutoGenerate, startDirectorChat, sendDirectorChatAudio, sendDirectorAudioChunk, sendDirectorAudioStreamStart, sendDirectorAudioStreamEnd, sendDirectorChatText, suggestDirectorPrompt, endDirectorChat } = useWebSocket(idToken, initialState, addToast);
  // Stable canvas key: freeze during generation so backend assigning story_id
  // doesn't cause a full StoryCanvas remount mid-generation.
  // Once a storyId is assigned, never revert to 'new' — prevents remount
  // when generation ends and the key would change from 'new' to the storyId.
  const canvasKeyRef = useRef(storyId || 'new');
  if (!generating && storyId) canvasKeyRef.current = storyId;
  const canvasKey = canvasKeyRef.current;

  const { theme, toggleTheme } = useTheme();
  const [directorOpen, setDirectorOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [directorVoice, setDirectorVoice] = useState(() => localStorage.getItem('storyforge-director-voice') || 'Charon');
  const handleSetDirectorVoice = useCallback((v) => { setDirectorVoice(v); localStorage.setItem('storyforge-director-voice', v); }, []);
  const [controlBarInput, setControlBarInput] = useState('');
  useEffect(() => { setControlBarInputHandler(setControlBarInput); }, [setControlBarInputHandler]);
  const singlePage = false;
  const [artStyle, setArtStyle] = useState('cinematic');
  const [template, setTemplate] = useState('storybook');
  useEffect(() => { document.documentElement.dataset.template = template; }, [template]);
  const [templateChosen, setTemplateChosen] = useState(false);
  const [controlBarVisible, setControlBarVisible] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showHeroUpload, setShowHeroUpload] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);
  demoModeRef.current = demoMode;
  const [demoSlideRequest, setDemoSlideRequest] = useState(undefined);
  const handleTemplateSelect = useCallback((key) => {
    setTemplate(key);
    setArtStyle(getTemplate(key).defaultArtStyle);
    setTemplateChosen(true);
    setControlBarVisible(false);
  }, []);
  const [languageRaw, setLanguageRaw] = useState('English');
  const setLanguage = useCallback((lang) => { setLanguageRaw(lang); setControlBarInput(''); }, []);
  const language = languageRaw;
  useEffect(() => { setLanguageDetectedHandler(setLanguage); }, [setLanguageDetectedHandler, setLanguage]);
  useEffect(() => { setArtStyleHandler((style) => { setArtStyle(style); setShowStylePicker(false); }); }, [setArtStyleHandler]);

  // Ctrl+Shift+D toggles demo conductor mode
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDemoMode(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Director navigate_app tool: end chat session, then route to destination
  useEffect(() => {
    setNavigateHandler((dest) => {
      // End Director Chat session before leaving the page
      endDirectorChat();
      // Small delay so the farewell audio has time to start playing
      setTimeout(() => {
        switch (dest) {
          case 'library': navigate('/library'); break;
          case 'explore': navigate('/explore'); break;
          case 'new_story': navigate('/'); break;
          case 'settings': setSettingsOpen(true); break;
        }
      }, 1500);
    });
  }, [setNavigateHandler, navigate, endDirectorChat]);
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const {
    saving, saved, generatingCover,
    storyStatus, setStoryStatus,
    showCompleteDialog, setShowCompleteDialog, completing,
    isPublished, setIsPublished,
    setShowPublishDialog,
    autoSaveCurrent, handleSave, handleComplete,
    resetSaved,
  } = useStoryActions({ storyId, scenes, generations, bookMeta, idToken, addToast, user, getValidToken });
  const [readingMode, setReadingMode] = useState(false);
  const [bookmarkedSceneIndex, setBookmarkedSceneIndex] = useState(null);

  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const isLibrary = pathname === ROUTES.LIBRARY;
  const isExplore = pathname === ROUTES.EXPLORE;
  const isBookPage = pathname.startsWith(ROUTES.BOOK_PREFIX);
  const _isNewStory = pathname === ROUTES.NEW;
  const isStoryRoute = pathname === ROUTES.HOME || pathname === ROUTES.NEW || pathname.startsWith(ROUTES.STORY_PREFIX);
  const [viewingReadOnly, setViewingReadOnly] = useState(false);

  // Auto-end Director Chat when navigating away from story canvas
  useEffect(() => {
    if (!isStoryRoute && directorChatActive) {
      endDirectorChat();
    }
  }, [isStoryRoute, directorChatActive, endDirectorChat]);

  // Auto-start Director Chat when template is first selected (voice-first UX)
  const templateJustChosen = useRef(false);
  useEffect(() => {
    if (templateChosen && !templateJustChosen.current && scenes.length === 0 && !directorChatActive && connected) {
      templateJustChosen.current = true;
      // Small delay so panel renders first
      const t = setTimeout(() => {
        startDirectorChat('', { language, voiceName: directorVoice, template, demoMode: demoModeRef.current });
      }, 300);
      return () => clearTimeout(t);
    }
    if (!templateChosen) templateJustChosen.current = false;
  }, [templateChosen, scenes.length, directorChatActive, connected, startDirectorChat, language, directorVoice, template]);

  // Show style picker (or hero upload) after Director greeting arrives
  const greetingShownRef = useRef(false);
  useEffect(() => {
    if (!templateChosen || scenes.length > 0 || greetingShownRef.current) return;
    // In demo mode, skip dialogs — Director handles everything verbally
    if (demoModeRef.current) return;
    // Wait for first Director message (greeting transcript)
    const hasGreeting = directorChatMessages.some(m => m.role === 'director');
    if (hasGreeting && directorChatActive) {
      greetingShownRef.current = true;
      // Small delay so greeting audio plays first
      const t = setTimeout(() => {
        if (template === 'hero') {
          setShowHeroUpload(true);
        } else {
          setShowStylePicker(true);
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [directorChatMessages, directorChatActive, templateChosen, scenes.length, template]);

  // Reset greeting shown ref when going back to templates
  useEffect(() => {
    if (!templateChosen) greetingShownRef.current = false;
  }, [templateChosen]);

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
    if (scenes.length > 0) {
      setHasBeenPopulated(true);
      setTemplateChosen(true);
      // ControlBar stays hidden — user can toggle via floating button
    }
  }, [scenes.length]);
  useEffect(() => {
    if (initialState === null || initialState === undefined) {
      setHasBeenPopulated(false);
      setTemplateChosen(false);
    }
  }, [initialState]);

  const isHydrating = !!(initialState?.scenes?.length) && scenes.length === 0 && !generating && !hasBeenPopulated;

  const { handleOpenBook, handleOpenPublicBook } = useBookManager({
    storyId, autoSaveCurrent, reset, load, navigate, user,
    setStoryStatus, setIsPublished, setArtStyle, setLanguage, setTemplate, setViewingReadOnly,
  });

  // All side effects extracted to useAppEffects
  useAppEffects({
    storyId, urlStoryId, isLibrary, isExplore, navigate,
    scenes, generating, initialState, idToken,
    bookMeta, setBookmarkedSceneIndex, resetSaved,
    setStoryStatus, setIsPublished, setArtStyle, setLanguage, setTemplate,
    setViewingReadOnly, setStoryDeletedHandler,
    clearState, addToast,
    location,
  });

  // Director auto-generation with 5-second countdown
  useDirectorAutoGenerate(directorAutoGenerate, send, setDirectorAutoGenerate, generating, artStyle, template);

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
  const { publicStory } = usePublicStory(authLoading, user, urlStoryId);

  // Loading splash
  const showSplash = authLoading || (user && storyLoading) || (user && initialState === undefined) || (user && isHydrating);

  const splashMessage = !user
    ? 'Connecting...'
    : isHydrating
      ? 'Resuming your story...'
      : 'Loading your story...';

  // Exit-reveal transition: detect showSplash going true→false
  const [splashExiting, setSplashExiting] = useState(false);
  const prevShowSplashRef = useRef(showSplash);
  const lastSplashMsgRef = useRef(splashMessage);
  if (showSplash) lastSplashMsgRef.current = splashMessage;

  useEffect(() => {
    if (prevShowSplashRef.current && !showSplash) {
      setSplashExiting(true);
      const timer = setTimeout(() => setSplashExiting(false), 700);
      return () => clearTimeout(timer);
    }
    prevShowSplashRef.current = showSplash;
  }, [showSplash]);

  if (showSplash) {
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
            <div style={{ cursor: 'pointer' }} onClick={() => navigate(ROUTES.HOME)}>
              <Logo size="compact" />
            </div>
            <div className="flex items-center header-actions">
              <button onClick={() => navigate(ROUTES.HOME)} className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-glow-primary)' }}>
                Sign in to create
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden relative z-10">
            <Routes>
              <Route path={ROUTES.BOOK(':storyId')} element={<BookDetailsPage user={null} />} />
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
              <button onClick={() => navigate(ROUTES.HOME)} className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-glow-primary)' }}>
                Sign in to create
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden relative z-10">
            <div className="flex-1 relative flex flex-col">
              <StoryCanvas scenes={publicStory.scenes} generating={false} userPrompt={null} error={null} onPageChange={() => {}} storyId={publicStory.storyId} displayPrompt={null} spreadPrompts={{ left: null, right: null }} />
            </div>
          </div>
          {readingMode && publicStory.scenes.length > 0 && (
            <ReadingMode scenes={publicStory.scenes} storyId={publicStory.storyId} onExit={() => setReadingMode(false)} template={publicStory.template || 'storybook'} />
          )}
        </div>
      );
    }
    // Terms page accessible without login
    if (pathname === ROUTES.TERMS) {
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
          navigate={navigate}
          onOpenSettings={() => setSettingsOpen(true)}
          user={user} signOut={signOut} isAdmin={isAdmin}
          userTier={usage?.usage?.tier || 'free'}
        />
        <div className="flex flex-1 overflow-hidden relative z-10">
          <AdminDashboard idToken={idToken} addToast={addToast} />
        </div>
        {settingsOpen && (
          <SettingsDialog onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} directorVoice={directorVoice} setDirectorVoice={handleSetDirectorVoice}  />
        )}
      </div>
    );
  }

  // Director data — always use the merged state (backend now analyzes ALL scenes per batch)
  const activeDirectorData = directorData || (() => {
    for (let i = generations.length - 1; i >= 0; i--) {
      if (generations[i].directorData) return generations[i].directorData;
    }
    return null;
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
        onOpenSettings={() => setSettingsOpen(true)}
        user={user} signOut={signOut}
        isAdmin={isAdmin}
        userTier={usage?.usage?.tier || 'free'}
        template={template} heroMode={heroMode}
      />

      <Routes>
        <Route
          path={ROUTES.LIBRARY}
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <LibraryPage user={user} onOpenBook={handleOpenBook} bookMeta={bookMeta} activeStoryId={storyId} onActiveStoryDeleted={() => { clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setTemplate('storybook'); setLanguage('English'); setBookmarkedSceneIndex(null); setTemplateChosen(false); navigate(ROUTES.HOME); }} onNewStory={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); setTemplate('storybook'); setLanguage('English'); setBookmarkedSceneIndex(null); setTemplateChosen(false); navigate(ROUTES.NEW); }} />
            </div>
          }
        />
        <Route
          path={ROUTES.EXPLORE}
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <ExplorePage user={user} onOpenBook={handleOpenPublicBook} />
            </div>
          }
        />
        <Route
          path={ROUTES.BOOK(':storyId')}
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <BookDetailsPage user={user} setAppIsPublished={setIsPublished} onOpenBook={handleOpenBook} onOpenPublicBook={handleOpenPublicBook} />
            </div>
          }
        />
        <Route
          path={ROUTES.SUBSCRIPTION}
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <SubscriptionPage idToken={idToken} addToast={addToast} />
            </div>
          }
        />
        <Route path={ROUTES.TERMS} element={<TermsPage />} />
        <Route
          path={ROUTES.ADMIN}
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
        {[ROUTES.HOME, ROUTES.NEW, ROUTES.STORY(':storyId')].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <SceneActionsContext.Provider value={sceneActionsValue}>
                <div className="flex flex-1 overflow-hidden relative z-10">
                  <div className="flex-1 relative flex flex-col min-w-0">
                    <StoryCanvas key={canvasKey} scenes={scenes} generating={generating} userPrompt={userPrompt} error={error} onPageChange={setCurrentSceneNumber} storyId={storyId} displayPrompt={viewingReadOnly ? null : displayPrompt} spreadPrompts={viewingReadOnly ? null : spreadPrompts} bookmarkPage={bookmarkedSceneIndex !== null ? bookmarkedSceneIndex + 1 : null} language={language} onLanguageChange={scenes.length === 0 && !templateChosen ? setLanguage : undefined} singlePage={singlePage} template={template} onTemplateSelect={!templateChosen ? handleTemplateSelect : undefined} onTemplateBack={templateChosen && scenes.length === 0 ? () => { endDirectorChat(); setTemplateChosen(false); setShowStylePicker(false); } : undefined} />
                    {!viewingReadOnly && !demoMode && storyStatus !== 'completed' && (templateChosen || scenes.length > 0) && (
                      <>
                        {controlBarVisible && (
                          <ControlBar onSend={(text, opts) => send(text, opts)} onSendAudio={(b64, mime) => sendAudio(b64, mime)} connected={connected} generating={generating} generationStage={generationStage} quotaCooldown={quotaCooldown} inputValue={controlBarInput} setInputValue={setControlBarInput} artStyle={artStyle} setArtStyle={setArtStyle} language={language} usage={usage} onHeroPhoto={sendHeroPhoto} heroMode={heroMode} template={template} />
                        )}
                        {generating ? (
                          <div className="control-bar-toggle control-bar-toggle--stage">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="control-stage-spin">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                            <span>{
                              generationStage === 'writing' ? 'Writing story...' :
                              generationStage === 'illustrating' ? 'Painting scene...' :
                              generationStage === 'narrating' ? 'Adding narration...' :
                              generationStage === 'saving' ? 'Saving story...' :
                              generationStage === 'finishing' ? 'Final touches...' :
                              'Generating...'
                            }</span>
                          </div>
                        ) : (
                          <button
                            className="control-bar-toggle"
                            onClick={() => setControlBarVisible(v => !v)}
                            aria-label={controlBarVisible ? 'Hide text input' : 'Show text input'}
                          >
                            {controlBarVisible ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="4" width="20" height="16" rx="2" />
                                  <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
                                  <line x1="6" y1="12" x2="18" y2="12" />
                                  <line x1="6" y1="16" x2="14" y2="16" />
                                </svg>
                                <span>Type a prompt</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                    {showStylePicker && (
                      <StylePickerDialog
                        template={template}
                        currentStyle={artStyle}
                        onSelect={(key) => { setArtStyle(key); }}
                        onClose={() => setShowStylePicker(false)}
                        nudgeTimeout={15000}
                        onNudge={() => {
                          sendDirectorChatText('[SYSTEM: The user hasn\'t picked an art style yet. Gently remind them to choose one from the style picker on screen.]');
                        }}
                      />
                    )}
                  </div>
                  {directorOpen && !viewingReadOnly && (templateChosen || scenes.length > 0) && <DirectorPanel singlePage={singlePage} heroMode={heroMode} template={template} artStyle={artStyle} data={activeDirectorData} generating={generating} scenes={scenes} currentSceneNumber={currentSceneNumber} language={language} liveNotes={directorLiveNotes} chatActive={directorChatActive} chatMessages={directorChatMessages} chatLoading={directorChatLoading} chatPrompt={directorChatPrompt} autoGenerate={directorAutoGenerate} onCancelAutoGenerate={cancelDirectorAutoGenerate} onStartChat={() => { const ctx = scenes.map(s => `Scene ${s.scene_number}: ${s.text}`).join('\n\n') || ''; startDirectorChat(ctx, { language, voiceName: directorVoice, template, demoMode: demoModeRef.current }); }} onEndChat={endDirectorChat} onChatAudio={sendDirectorChatAudio} onChatAudioChunk={sendDirectorAudioChunk} onChatAudioStreamStart={sendDirectorAudioStreamStart} onChatAudioStreamEnd={sendDirectorAudioStreamEnd} onChatNudge={sendDirectorChatText} onChatSuggest={() => { const ctx = scenes.map(s => `Scene ${s.scene_number}: ${s.text}`).join('\n\n') || ''; suggestDirectorPrompt(ctx); }} onUsePrompt={(prompt) => { setControlBarInput(prompt); }} setAudioChunkHandler={setAudioChunkHandler} setAudioDoneHandler={setAudioDoneHandler} />}
                </div>
              </SceneActionsContext.Provider>
            }
          />
        ))}
        <Route path="*" element={<div className="flex flex-1 overflow-hidden relative z-10"><NotFoundPage /></div>} />
      </Routes>

      {readingMode && scenes.length > 0 && (
        <ReadingMode scenes={scenes} storyId={storyId} idToken={idToken} onExit={() => setReadingMode(false)} onBookmarkChange={setBookmarkedSceneIndex} template={template} />
      )}

      {showCompleteDialog && (
        <CompleteBookDialog completing={completing} onClose={() => setShowCompleteDialog(false)} onComplete={handleComplete} />
      )}

      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} directorVoice={directorVoice} setDirectorVoice={handleSetDirectorVoice}  />
      )}

      {splashExiting && <SplashScreen message={lastSplashMsgRef.current} exiting />}


      {showHeroUpload && (
        <HeroUploadDialog
          onUpload={(base64, mimeType, name) => {
            sendHeroPhoto(base64, mimeType, name);
            // After hero upload, show style picker
            setTimeout(() => setShowStylePicker(true), 500);
          }}
          onClose={() => setShowHeroUpload(false)}
          nudgeTimeout={20000}
          onNudge={() => {
            sendDirectorChatText('[SYSTEM: The user hasn\'t uploaded their hero photo yet. Remind them warmly to upload a photo so they can star in their own adventure.]');
          }}
        />
      )}

      {demoMode && (
        <DemoConductor
          generating={generating}
          onSlideRequest={setDemoSlideRequest}
          onClose={() => setDemoMode(false)}
        />
      )}

      <DemoOverlay
        generating={generating}
        chatActive={directorChatActive}
        chatLoading={directorChatLoading}
        requestedSlide={demoSlideRequest}
        onSlideRequestHandled={() => setDemoSlideRequest(undefined)}
      />
    </div>
  );
}
