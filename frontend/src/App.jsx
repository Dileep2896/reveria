import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { SceneActionsContext } from './contexts/SceneActionsContext';
import useWebSocket from './hooks/useWebSocket';
import useAmbientAudio from './hooks/useAmbientAudio';
import useLiveVoice from './hooks/useLiveVoice';
import useActiveStory from './hooks/useActiveStory';
import useStoryActions from './hooks/useStoryActions';
import useBookManager from './hooks/useBookManager';
import {
  db,
  getDoc,
  doc,
  updateDoc,
} from './firebase';
import { API_URL, findFallbackCover } from './utils/storyHelpers';

import Logo from './components/Logo';
import StoryCanvas from './components/StoryCanvas';
import AppHeader from './components/AppHeader';
import CompleteBookDialog from './components/dialogs/CompleteBookDialog';
import PublishDialog from './components/dialogs/PublishDialog';
import DirectorPanel from './components/DirectorPanel';
import ControlBar from './components/ControlBar';
import LibraryPage from './components/LibraryPage';
import ExplorePage from './components/ExplorePage';
import ReadingMode from './components/ReadingMode';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, idToken, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  // Extract storyId from URL: /story/:storyId
  const urlStoryMatch = location.pathname.match(/^\/story\/(.+?)(?:\/|$)/);
  const urlStoryId = urlStoryMatch ? urlStoryMatch[1] : null;

  const { initialState, storyLoading, clearState } = useActiveStory(user, urlStoryId);
  const { addToast } = useToast();
  const { connected, scenes, generating, userPrompt, error, directorData, generations, storyId, quotaCooldown, sceneBusy, bookMeta, portraits, portraitsLoading, send, sendAudio, sendSceneAction, sendPortraitRequest, reset, load, wsRef, setLiveHandler, setStoryDeletedHandler } = useWebSocket(idToken, initialState, addToast);
  const { theme, toggleTheme } = useTheme();
  const [directorOpen, setDirectorOpen] = useState(true);
  const [controlBarInput, setControlBarInput] = useState('');
  const [artStyle, setArtStyle] = useState('cinematic');
  const [language, setLanguageRaw] = useState('English');
  const setLanguage = useCallback((lang) => { setLanguageRaw(lang); setControlBarInput(''); }, []);
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const {
    saving, saved, generatingCover,
    storyStatus, setStoryStatus,
    showCompleteDialog, setShowCompleteDialog, completing,
    isPublished, setIsPublished,
    showPublishDialog, setShowPublishDialog, publishing,
    autoSaveCurrent, handleSave, handleComplete, handlePublish,
    resetSaved,
  } = useStoryActions({ storyId, scenes, generations, bookMeta, idToken, addToast, user });
  const [readingMode, setReadingMode] = useState(false);
  const ambient = useAmbientAudio();
  const live = useLiveVoice(wsRef);
  const [bookmarkedSceneIndex, setBookmarkedSceneIndex] = useState(null);

  const isLibrary = location.pathname === '/library';
  const isExplore = location.pathname === '/explore';
  const [viewingReadOnly, setViewingReadOnly] = useState(false);

  // Per-scene action callbacks
  const handleRegenImage = useCallback((sceneNumber, sceneText) => {
    if (!storyId || generating) return;
    sendSceneAction('regen_image', { scene_number: sceneNumber, scene_text: sceneText, story_id: storyId });
  }, [storyId, generating, sendSceneAction]);

  const handleRegenScene = useCallback((sceneNumber, sceneText) => {
    if (!storyId || generating) return;
    const allScenes = scenes.map((s) => ({ scene_number: s.scene_number, text: s.text }));
    sendSceneAction('regen_scene', { scene_number: sceneNumber, scene_text: sceneText, all_scenes: allScenes, story_id: storyId });
  }, [storyId, generating, scenes, sendSceneAction]);

  const handleDeleteScene = useCallback((sceneNumber) => {
    if (!storyId || generating) return;
    sendSceneAction('delete_scene', { scene_number: sceneNumber, story_id: storyId });
  }, [storyId, generating, sendSceneAction]);

  const sceneActionsValue = useMemo(() => ({
    regenImage: handleRegenImage,
    regenScene: handleRegenScene,
    deleteScene: handleDeleteScene,
    sceneBusy,
    isReadOnly: viewingReadOnly || storyStatus === 'completed',
  }), [handleRegenImage, handleRegenScene, handleDeleteScene, sceneBusy, viewingReadOnly, storyStatus]);

  // Sync storyId → URL: navigate to /story/:id when storyId changes
  useEffect(() => {
    if (!storyId || isLibrary || isExplore) return;
    if (urlStoryId === storyId) return; // URL already matches
    navigate(`/story/${storyId}`, { replace: true });
  }, [storyId, urlStoryId, isLibrary, isExplore, navigate]);

  // Track whether scenes were ever populated (hydration completed at least once).
  // Without this, deleting all scenes would re-trigger the hydrating splash.
  const [hasBeenPopulated, setHasBeenPopulated] = useState(false);
  useEffect(() => {
    if (scenes.length > 0) setHasBeenPopulated(true);
  }, [scenes.length]);
  useEffect(() => {
    if (initialState === null || initialState === undefined) setHasBeenPopulated(false);
  }, [initialState]);

  // True while Firestore returned scenes but useWebSocket hasn't hydrated them yet
  const isHydrating = !!(initialState?.scenes?.length) && scenes.length === 0 && !generating && !hasBeenPopulated;

  const handleGenreClick = useCallback((prompt) => {
    setControlBarInput(prompt);
  }, []);

  // Reset "Saved!" when new generation starts
  useEffect(() => {
    if (generating) resetSaved();
  }, [generating, resetSaved]);

  // Persist bookMeta to Firestore as soon as it arrives from WS
  useEffect(() => {
    if (!bookMeta || !storyId) return;
    const storyRef = doc(db, 'stories', storyId);
    getDoc(storyRef).then((snap) => {
      if (snap.exists() && snap.data().title_generated) return; // already written
      updateDoc(storyRef, {
        title: bookMeta.title || 'Untitled Story',
        cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
        title_generated: true,
        updated_at: new Date(),
      }).catch((err) => console.error('Failed to persist bookMeta:', err));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scenes used only as fallback cover; must not re-run on scene changes
  }, [bookMeta, storyId]);

  // Fetch bookmark for current story
  useEffect(() => {
    if (!storyId || !idToken) {
      setBookmarkedSceneIndex(null);
      return;
    }
    fetch(`${API_URL}/api/stories/${storyId}/bookmark`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.scene_index != null) {
          setBookmarkedSceneIndex(data.scene_index);
        } else {
          setBookmarkedSceneIndex(null);
        }
      })
      .catch(() => setBookmarkedSceneIndex(null));
  }, [storyId, idToken]);

  // Clear read-only mode when navigating away from story view
  useEffect(() => {
    if (location.pathname !== '/' && !location.pathname.startsWith('/story/')) setViewingReadOnly(false);
  }, [location.pathname]);

  // Sync storyStatus + artStyle from loaded initial state
  useEffect(() => {
    if (initialState === null || initialState === undefined) {
      setStoryStatus(null);
      setIsPublished(false);
    } else if (initialState) {
      setStoryStatus(initialState.status || 'draft');
      setIsPublished(initialState.is_public || false);
      if (initialState.art_style) setArtStyle(initialState.art_style);
      if (initialState.language) setLanguage(initialState.language);
    }
  }, [initialState, setStoryStatus, setIsPublished, setLanguage]);

  const { handleOpenBook, handleOpenPublicBook } = useBookManager({
    storyId, autoSaveCurrent, reset, load, navigate, user,
    setStoryStatus, setIsPublished, setArtStyle, setLanguage, setViewingReadOnly,
  });

  // Register live voice message handler
  useEffect(() => {
    setLiveHandler(live.handleMessage);
  }, [setLiveHandler, live.handleMessage]);

  // Handle backend deleting the entire story (all scenes removed)
  useEffect(() => {
    setStoryDeletedHandler(() => {
      clearState();
      setStoryStatus(null);
      setIsPublished(false);
      setArtStyle('cinematic');
      setLanguage('English');
      setBookmarkedSceneIndex(null);
      navigate('/');
      addToast('Story deleted — all scenes were removed', 'info');
    });
  }, [setStoryDeletedHandler, clearState, navigate, addToast, setStoryStatus, setIsPublished, setLanguage]);

  // Crossfade ambient music when director mood changes
  const lastAmbientMood = useRef(null);
  useEffect(() => {
    const mood = directorData?.visual_style?.mood;
    if (mood && mood !== lastAmbientMood.current) {
      lastAmbientMood.current = mood;
      ambient.crossfadeTo(mood);
    }
  }, [directorData, ambient]);

  // Derive per-scene image tier info for DirectorPanel
  const imageTiers = useMemo(() =>
    scenes
      .filter(s => s.image_url && s.image_url !== 'error')
      .map(s => ({ scene: s.scene_number, tier: s.image_tier || 1 })),
    [scenes]
  );

  // Memoize spreadPrompts so StoryCanvas memo isn't defeated by new object reference
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

  // Auth loading, story loading, or hydrating — branded splash
  // initialState === undefined means useActiveStory hasn't resolved yet for this user
  const showSplash = authLoading || (user && storyLoading) || (user && initialState === undefined) || (user && isHydrating);

  if (showSplash) {
    const splashMessage = !user
      ? 'Connecting...'
      : isHydrating
        ? 'Resuming your story...'
        : 'Loading your story...';

    return (
      <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
        <div
          className="fixed inset-0 -z-10"
          style={{ background: 'var(--bg-gradient)' }}
        >
          <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
          <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
          <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
        </div>

        <div
          className="flex flex-col items-center"
          style={{ animation: 'fadeIn 0.6s ease-out' }}
        >
          <Logo size="full" />

          {/* Progress bar */}
          <div
            style={{
              width: '120px',
              height: '2px',
              borderRadius: '1px',
              background: 'var(--glass-border)',
              overflow: 'hidden',
              marginTop: '1.5rem',
            }}
          >
            <div
              style={{
                width: '40%',
                height: '100%',
                borderRadius: '1px',
                background: 'var(--accent-primary)',
                boxShadow: '0 0 8px var(--accent-primary-glow)',
                animation: 'loadingSlide 1.4s ease-in-out infinite',
              }}
            />
          </div>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              marginTop: '1rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              animation: 'loadingTextPulse 2s ease-in-out infinite',
            }}
          >
            {splashMessage}
          </p>
        </div>

        <style>{`
          @keyframes loadingSlide {
            0% { transform: translateX(-120px); }
            100% { transform: translateX(300px); }
          }
          @keyframes loadingTextPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  // Not signed in — show public story or sign-in screen
  if (!user) {
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
              <button onClick={signInWithGoogle} className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-glow-primary)' }}>
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
    return (
      <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
        {/* Full background matching main app */}
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

        {/* Glass card */}
        <div
          className="flex flex-col items-center px-12 py-10 rounded-2xl"
          style={{
            background: 'var(--glass-bg-strong)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-glass)',
          }}
        >
          <Logo size="full" />

          <p className="mt-3 mb-1 text-sm tracking-wide uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            AI-Powered Interactive Fiction
          </p>

          <div
            className="w-16 my-6"
            style={{ height: '1px', background: 'var(--glass-border)' }}
          />

          <p className="mb-6" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Sign in to start crafting your story
          </p>

          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-3 px-8 py-3 rounded-full font-semibold transition-all cursor-pointer"
            style={{
              background: 'white',
              color: '#333',
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // Derive per-scene director data based on which batch the current scene belongs to
  const activeDirectorData = (() => {
    // During generation, use live directorData from WebSocket
    if (generating) return directorData;
    // If a specific scene is focused, find its batch
    if (currentSceneNumber && generations.length) {
      const batch = generations.find(g => g.sceneNumbers.includes(currentSceneNumber));
      if (batch?.directorData) return batch.directorData;
    }
    // Use live directorData if available (set during current session)
    if (directorData) return directorData;
    // Fall back to the most recent generation's director data (hydrated from Firestore on reload)
    for (let i = generations.length - 1; i >= 0; i--) {
      if (generations[i].directorData) return generations[i].directorData;
    }
    return null;
  })();

  // Derive batch scene numbers and titles for tension bar labels
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

  // Use memoized spreadPrompts (computed before early returns for hook order safety)
  const spreadPrompts = spreadPromptsMemo;
  const displayPrompt = spreadPrompts.left;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Background layer with gradient + color orbs */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
        {/* Noise texture for depth */}
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
        isLibrary={isLibrary} isExplore={isExplore}
        scenes={scenes} generating={generating}
        autoSaveCurrent={autoSaveCurrent} clearState={clearState}
        setStoryStatus={setStoryStatus} setIsPublished={setIsPublished} setArtStyle={setArtStyle} setLanguage={setLanguage} setBookmarkedSceneIndex={setBookmarkedSceneIndex}
        saving={saving} saved={saved} generatingCover={generatingCover} handleSave={handleSave}
        storyStatus={storyStatus} setShowCompleteDialog={setShowCompleteDialog}
        isPublished={isPublished} setShowPublishDialog={setShowPublishDialog}
        setReadingMode={setReadingMode}
        idToken={idToken} addToast={addToast}
        directorOpen={directorOpen} setDirectorOpen={setDirectorOpen}
        ambient={ambient}
        theme={theme} toggleTheme={toggleTheme}
        user={user} signOut={signOut}
      />

      {/* Routed content */}
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
        {['/story/:storyId', '*'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <SceneActionsContext.Provider value={sceneActionsValue}>
                <div className="flex flex-1 overflow-hidden relative z-10">
                  <div className="flex-1 relative flex flex-col">
                    <StoryCanvas key={storyId || 'new'} scenes={scenes} generating={generating} userPrompt={userPrompt} error={error} onGenreClick={handleGenreClick} onPageChange={setCurrentSceneNumber} storyId={storyId} displayPrompt={displayPrompt} spreadPrompts={spreadPrompts} bookmarkPage={bookmarkedSceneIndex !== null ? bookmarkedSceneIndex + 1 : null} language={language} />
                    {!viewingReadOnly && storyStatus !== 'completed' && (
                      <ControlBar onSend={(text, opts) => { if (scenes.length === 0) addToast(`Language set to ${language} — can't be changed for this story`, 'info'); send(text, opts); }} onSendAudio={(b64, mime) => { if (scenes.length === 0) addToast(`Language set to ${language} — can't be changed for this story`, 'info'); sendAudio(b64, mime); }} connected={connected} generating={generating} quotaCooldown={quotaCooldown} inputValue={controlBarInput} setInputValue={setControlBarInput} artStyle={artStyle} setArtStyle={setArtStyle} language={language} setLanguage={setLanguage} languageLocked={scenes.length > 0} live={live} />
                    )}
                  </div>
                  {directorOpen && !viewingReadOnly && <DirectorPanel data={activeDirectorData} generating={generating} sceneNumbers={activeBatchSceneNumbers} sceneTitles={activeBatchSceneTitles} imageTiers={imageTiers} portraits={portraits} portraitsLoading={portraitsLoading} onGeneratePortraits={storyStatus === 'completed' ? null : sendPortraitRequest} language={language} />}
                </div>
              </SceneActionsContext.Provider>
            }
          />
        ))}
      </Routes>

      {/* Reading Mode overlay */}
      {readingMode && scenes.length > 0 && (
        <ReadingMode scenes={scenes} storyId={storyId} idToken={idToken} onExit={() => setReadingMode(false)} onBookmarkChange={setBookmarkedSceneIndex} />
      )}

      {showCompleteDialog && (
        <CompleteBookDialog completing={completing} onClose={() => setShowCompleteDialog(false)} onComplete={handleComplete} />
      )}
      {showPublishDialog && (
        <PublishDialog publishing={publishing} onClose={() => setShowPublishDialog(false)} onPublish={handlePublish} />
      )}
    </div>
  );
}
