import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { SceneActionsContext } from './contexts/SceneActionsContext';
import useWebSocket from './hooks/useWebSocket';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from './firebase';

const API_URL = (() => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
})();
import Logo from './components/Logo';
import ProfileMenu from './components/ProfileMenu';
import StoryCanvas from './components/StoryCanvas';
import DirectorPanel from './components/DirectorPanel';
import ControlBar from './components/ControlBar';
import LibraryPage from './components/LibraryPage';
import ExplorePage from './components/ExplorePage';

async function loadStoryById(storyId) {
  const storyDoc = await getDoc(doc(db, 'stories', storyId));
  const storyData = storyDoc.exists() ? storyDoc.data() : {};

  const scenesSnap = await getDocs(collection(db, 'stories', storyId, 'scenes'));
  const scenes = scenesSnap.docs
    .map((d) => d.data())
    .sort((a, b) => a.scene_number - b.scene_number);

  const gensSnap = await getDocs(collection(db, 'stories', storyId, 'generations'));
  const generations = gensSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        prompt: data.prompt,
        directorData: data.director_data || null,
        sceneNumbers: data.scene_numbers || [],
      };
    })
    .sort((a, b) => {
      const aFirst = a.sceneNumbers[0] ?? 0;
      const bFirst = b.sceneNumbers[0] ?? 0;
      return aFirst - bFirst;
    });

  return { storyId, scenes, generations, status: storyData.status || 'draft', is_public: storyData.is_public || false, art_style: storyData.art_style || 'cinematic' };
}

function findFallbackCover(scenes) {
  return scenes.find(
    (s) => s.image_url && s.image_url !== 'error' && !s.image_url.startsWith('data:')
  )?.image_url || null;
}

function useActiveStory(user, urlStoryId) {
  const [initialState, setInitialState] = useState(undefined);
  const [storyLoading, setStoryLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!user) {
      setInitialState(undefined);
      setStoryLoading(false);
      hasLoaded.current = false;
      return;
    }

    // Only load once per user session — subsequent navigation uses handleOpenBook/load
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    setStoryLoading(true);
    setInitialState(undefined);

    let cancelled = false;

    async function loadActiveStory() {
      try {
        let storyId = null;

        // If URL specifies a story, try loading it first
        if (urlStoryId) {
          const docSnap = await getDoc(doc(db, 'stories', urlStoryId));
          if (!cancelled && docSnap.exists() && docSnap.data().uid === user.uid) {
            storyId = urlStoryId;
          }
        }

        // Fallback: load most recently updated story
        if (!storyId) {
          const storiesRef = collection(db, 'stories');
          const q = query(
            storiesRef,
            where('uid', '==', user.uid),
            where('status', 'in', ['draft', 'saved', 'completed']),
            orderBy('updated_at', 'desc'),
            limit(1),
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          if (snap.empty) {
            setInitialState(null);
            setStoryLoading(false);
            return;
          }
          storyId = snap.docs[0].id;
        }

        if (cancelled) return;

        const state = await loadStoryById(storyId);
        if (cancelled) return;
        setInitialState(state);
      } catch (err) {
        console.error('Failed to load active story:', err);
        if (!cancelled) setInitialState(null);
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    }

    loadActiveStory();
    return () => { cancelled = true; };
  }, [user, urlStoryId]);

  const clearState = useCallback(() => setInitialState(null), []);

  return { initialState, storyLoading, clearState };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, idToken, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  // Extract storyId from URL: /story/:storyId
  const urlStoryMatch = location.pathname.match(/^\/story\/(.+?)(?:\/|$)/);
  const urlStoryId = urlStoryMatch ? urlStoryMatch[1] : null;

  const { initialState, storyLoading, clearState } = useActiveStory(user, urlStoryId);
  const { addToast } = useToast();
  const { connected, scenes, generating, userPrompt, error, directorData, generations, storyId, quotaCooldown, sceneBusy, bookMeta, send, sendAudio, sendSceneAction, reset, load } = useWebSocket(idToken, initialState, addToast);
  const { theme, toggleTheme } = useTheme();
  const [directorOpen, setDirectorOpen] = useState(true);
  const [controlBarInput, setControlBarInput] = useState('');
  const [artStyle, setArtStyle] = useState('cinematic');
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [storyStatus, setStoryStatus] = useState(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

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

  // True while Firestore returned scenes but useWebSocket hasn't hydrated them yet
  const isHydrating = !!(initialState?.scenes?.length) && scenes.length === 0 && !generating;

  const handleGenreClick = useCallback((prompt) => {
    setControlBarInput(prompt);
  }, []);

  // Reset "Saved!" when new generation starts
  useEffect(() => {
    if (generating) setSaved(false);
  }, [generating]);

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
  }, [bookMeta, storyId]);

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
    }
  }, [initialState]);

  // Generate AI book title + cover via backend
  const generateBookMeta = useCallback(async (sceneTexts, artStyle, sid) => {
    try {
      const token = idToken;
      const res = await fetch(`${API_URL}/api/generate-book-meta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scene_texts: sceneTexts,
          art_style: artStyle,
          story_id: sid,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('Book meta generation failed:', err);
      return null;
    }
  }, [idToken]);

  // Auto-save current story as 'saved' (used when switching away from a draft)
  // NEVER calls generateBookMeta — always fast (~200ms)
  const autoSaveCurrent = useCallback(async () => {
    if (!storyId || scenes.length === 0 || storyStatus === 'completed') return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      const snap = await getDoc(storyRef);
      const alreadyGenerated = snap.exists() && snap.data().title_generated;

      // Tier 1: already has AI title + cover
      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        return;
      }

      // Tier 2: bookMeta arrived from WebSocket background task
      if (bookMeta) {
        await updateDoc(storyRef, {
          status: 'saved',
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          updated_at: new Date(),
        });
        return;
      }

      // Tier 3: use prompt title + first scene image (no API call)
      // title_generated stays false so background task or explicit Save can upgrade later
      await updateDoc(storyRef, {
        status: 'saved',
        title: (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
        cover_image_url: findFallbackCover(scenes),
        updated_at: new Date(),
      });
    } catch (err) {
      console.error('Failed to auto-save story:', err);
    }
  }, [storyId, scenes, generations, storyStatus, bookMeta]);

  const handleSave = useCallback(async () => {
    if (!storyId || saving || generatingCover || storyStatus === 'completed') return;
    const capturedStoryId = storyId;

    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      const alreadyGenerated = snap.exists() && snap.data().title_generated;

      // Tier 1: already has AI title + cover — just update status (instant)
      if (alreadyGenerated) {
        setSaving(true);
        await updateDoc(storyRef, { status: 'saved', updated_at: new Date() });
        setStoryStatus('saved');
        setSaved(true);
        addToast('Story saved!', 'success');
        setTimeout(() => setSaved(false), 3000);
        return;
      }

      // Tier 2: bookMeta available from WS — write it + set flag (instant)
      if (bookMeta) {
        setSaving(true);
        await updateDoc(storyRef, {
          status: 'saved',
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          updated_at: new Date(),
        });
        setStoryStatus('saved');
        setSaved(true);
        addToast('Story saved!', 'success');
        setTimeout(() => setSaved(false), 3000);
        return;
      }

      // Tier 3: call API with spinner → write result + set flag
      let title = (generations[0]?.prompt || 'Untitled Story').slice(0, 60);
      let coverUrl = findFallbackCover(scenes);

      setGeneratingCover(true);
      addToast('Generating AI title & cover...', 'info');
      const sceneTexts = scenes.map((s) => s.text).filter(Boolean);
      const artStyle = scenes[0]?.art_style || 'cinematic';
      const meta = await generateBookMeta(sceneTexts, artStyle, capturedStoryId);
      setGeneratingCover(false);
      if (meta) {
        title = meta.title || title;
        coverUrl = meta.cover_image_url || coverUrl;
        if (!meta.cover_image_url && meta.title) {
          addToast('Cover generation blocked — using scene image', 'warning');
        }
      }

      // Guard: user may have navigated away during async cover generation
      if (storyId !== capturedStoryId) return;

      setSaving(true);
      await updateDoc(storyRef, {
        status: 'saved',
        title,
        cover_image_url: coverUrl,
        title_generated: true,
        updated_at: new Date(),
      });
      setStoryStatus('saved');
      setSaved(true);
      addToast('Story saved!', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save story:', err);
      addToast('Failed to save story', 'error');
      setGeneratingCover(false);
    } finally {
      setSaving(false);
    }
  }, [storyId, saving, generatingCover, storyStatus, generations, scenes, bookMeta, generateBookMeta, addToast]);

  const handleOpenBook = useCallback(async (bookData) => {
    setViewingReadOnly(false);
    if (bookData.storyId !== storyId) {
      await autoSaveCurrent();
      reset();
    }

    // Touch updated_at so this book becomes the most recent for auto-resume
    try {
      await updateDoc(doc(db, 'stories', bookData.storyId), {
        updated_at: new Date(),
      });
    } catch (err) {
      console.error('Failed to set draft status:', err);
    }

    const isCompleted = bookData.status === 'completed';
    setStoryStatus(bookData.status || 'draft');
    setIsPublished(bookData.is_public || false);
    if (bookData.art_style) setArtStyle(bookData.art_style);

    setTimeout(() => {
      load(bookData, { skipResume: isCompleted });
      navigate(`/story/${bookData.storyId}`);
    }, 50);
  }, [storyId, autoSaveCurrent, reset, load, navigate]);

  const handleOpenPublicBook = useCallback((bookData) => {
    const isOwn = bookData.authorUid === user?.uid;
    if (!isOwn) {
      reset();
      setViewingReadOnly(true);
      setTimeout(() => {
        load(bookData, { skipResume: true });
        navigate(`/story/${bookData.storyId}`);
      }, 50);
    } else if (bookData.status === 'completed') {
      // Own completed book — view only, no WS resume
      reset();
      setStoryStatus('completed');
      setIsPublished(bookData.is_public || false);
      setTimeout(() => {
        load(bookData, { skipResume: true });
        navigate(`/story/${bookData.storyId}`);
      }, 50);
    } else {
      handleOpenBook(bookData);
    }
  }, [user, reset, load, navigate, handleOpenBook]);

  const handleComplete = useCallback(async () => {
    if (!storyId || completing) return;
    const capturedStoryId = storyId;
    setCompleting(true);
    try {
      const storyRef = doc(db, 'stories', capturedStoryId);
      const snap = await getDoc(storyRef);
      const alreadyGenerated = snap.exists() && snap.data().title_generated;

      // Tier 1: already has AI title + cover — just complete
      if (alreadyGenerated) {
        await updateDoc(storyRef, { status: 'completed', updated_at: new Date() });
        if (storyId === capturedStoryId) setStoryStatus('completed');
        setShowCompleteDialog(false);
        addToast('Book completed!', 'success');
        return;
      }

      // Tier 2: bookMeta available from WS — write it + complete
      if (bookMeta) {
        await updateDoc(storyRef, {
          title: bookMeta.title || (generations[0]?.prompt || 'Untitled Story').slice(0, 60),
          cover_image_url: bookMeta.coverUrl || findFallbackCover(scenes),
          title_generated: true,
          status: 'completed',
          updated_at: new Date(),
        });
        if (storyId === capturedStoryId) setStoryStatus('completed');
        setShowCompleteDialog(false);
        addToast('Book completed!', 'success');
        return;
      }

      // Tier 3: call API → write result + complete
      let title = (generations[0]?.prompt || 'Untitled Story').slice(0, 60);
      let coverUrl = findFallbackCover(scenes);

      addToast('Generating AI title & cover...', 'info');
      const sceneTexts = scenes.map((s) => s.text).filter(Boolean);
      const artStyle = scenes[0]?.art_style || 'cinematic';
      const meta = await generateBookMeta(sceneTexts, artStyle, capturedStoryId);
      if (meta) {
        title = meta.title || title;
        coverUrl = meta.cover_image_url || coverUrl;
      }

      // Guard: user may have navigated away during async cover generation
      if (storyId !== capturedStoryId) return;

      await updateDoc(storyRef, {
        title,
        cover_image_url: coverUrl,
        title_generated: true,
        status: 'completed',
        updated_at: new Date(),
      });
      setStoryStatus('completed');
      setShowCompleteDialog(false);
      addToast('Book completed!', 'success');
    } catch (err) {
      console.error('Failed to complete book:', err);
      addToast('Failed to complete book', 'error');
    } finally {
      setCompleting(false);
    }
  }, [storyId, completing, scenes, generations, bookMeta, generateBookMeta, addToast]);

  const handlePublishToggle = useCallback(async () => {
    if (!storyId) return;
    try {
      const newPublished = !isPublished;
      const updates = { is_public: newPublished };
      if (newPublished) {
        updates.published_at = new Date();
        updates.author_name = user?.displayName || 'Anonymous';
        updates.author_photo_url = user?.photoURL || null;
      }
      await updateDoc(doc(db, 'stories', storyId), updates);
      setIsPublished(newPublished);
    } catch (err) {
      console.error('Failed to toggle publish:', err);
    }
  }, [storyId, isPublished, user]);

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

  // Not signed in — show sign-in screen
  if (!user) {
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

  // Derive batch scene numbers for tension bar labels
  const activeBatchSceneNumbers = (() => {
    if (generating || !currentSceneNumber || !generations.length) return null;
    const batch = generations.find(g => g.sceneNumbers.includes(currentSceneNumber));
    return batch?.sceneNumbers || null;
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

      {/* Header — frosted glass */}
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
              onClick={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); navigate('/'); }}
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

          {/* Publish — visible when story is completed */}
          {!isLibrary && !isExplore && !viewingReadOnly && storyStatus === 'completed' && storyId && (
            <button
              onClick={handlePublishToggle}
              className="rounded-full font-semibold transition-all uppercase tracking-wider header-btn"
              style={{
                background: isPublished ? 'var(--accent-primary-soft)' : 'var(--glass-bg)',
                color: isPublished ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: `1px solid ${isPublished ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
                backdropFilter: 'var(--glass-blur)',
                boxShadow: isPublished ? 'var(--shadow-glow-primary)' : 'none',
              }}
            >
              {isPublished ? 'Published' : 'Publish'}
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

      {/* Routed content */}
      <Routes>
        <Route
          path="/library"
          element={
            <div className="flex flex-1 overflow-hidden relative z-10">
              <LibraryPage user={user} onOpenBook={handleOpenBook} bookMeta={bookMeta} activeStoryId={storyId} onActiveStoryDeleted={() => { clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); navigate('/'); }} onNewStory={async () => { await autoSaveCurrent(); clearState(); reset(); setStoryStatus(null); setIsPublished(false); setArtStyle('cinematic'); navigate('/'); }} />
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
                    <StoryCanvas key={storyId || 'new'} scenes={scenes} generating={generating} userPrompt={userPrompt} error={error} onGenreClick={handleGenreClick} onPageChange={setCurrentSceneNumber} storyId={storyId} displayPrompt={displayPrompt} spreadPrompts={spreadPrompts} />
                    {!viewingReadOnly && storyStatus !== 'completed' && (
                      <ControlBar onSend={send} onSendAudio={sendAudio} connected={connected} generating={generating} quotaCooldown={quotaCooldown} inputValue={controlBarInput} setInputValue={setControlBarInput} artStyle={artStyle} setArtStyle={setArtStyle} />
                    )}
                  </div>
                  {directorOpen && !viewingReadOnly && <DirectorPanel data={activeDirectorData} generating={generating} sceneNumbers={activeBatchSceneNumbers} imageTiers={imageTiers} />}
                </div>
              </SceneActionsContext.Provider>
            }
          />
        ))}
      </Routes>

      {/* Complete Book confirmation dialog */}
      {showCompleteDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.25s ease',
          }}
          onClick={() => !completing && setShowCompleteDialog(false)}
        >
          <div
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',
              borderRadius: '1.25rem',
              padding: '2.5rem 2.5rem 2rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 40px var(--accent-primary-glow)',
              animation: 'dialogPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon with glow ring */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              margin: '0 auto 1.25rem',
              borderRadius: '50%',
              background: 'var(--accent-primary-soft)',
              border: '1px solid var(--glass-border-accent)',
              boxShadow: '0 0 24px var(--accent-primary-glow)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.6rem',
              letterSpacing: '0.01em',
            }}>
              Complete This Book?
            </h3>

            {/* Decorative divider */}
            <div style={{
              width: '40px',
              height: '1px',
              margin: '0 auto 0.8rem',
              background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
              opacity: 0.5,
            }} />

            <p style={{
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              lineHeight: 1.7,
              margin: '0 auto 2rem',
              maxWidth: '300px',
            }}>
              Once completed, this book will be locked from further editing. You'll then be able to publish it to Explore.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCompleteDialog(false)}
                disabled={completing}
                className="transition-all"
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '999px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-secondary)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: completing ? 'default' : 'pointer',
                  opacity: completing ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="transition-all"
                style={{
                  padding: '0.6rem 1.75rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: completing ? 'default' : 'pointer',
                  opacity: completing ? 0.7 : 1,
                  boxShadow: '0 4px 16px var(--accent-primary-glow)',
                }}
              >
                {completing ? 'Completing...' : 'Complete'}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes dialogPop {
              0% { opacity: 0; transform: scale(0.9) translateY(10px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
