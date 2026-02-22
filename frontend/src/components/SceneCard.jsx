import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSceneActions } from '../contexts/SceneActionsContext';

/* ── Fixed-position tooltip that escapes overflow:hidden parents ── */
function ActionBtn({ label, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const ref = useRef(null);
  const onEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setPos({ top: r.top - 28, left: r.left + r.width / 2 });
      }
      setShow(true);
    }, 400);
  }, []);
  const onLeave = useCallback(() => { clearTimeout(timer.current); setShow(false); }, []);
  return (
    <span ref={ref} style={{ display: 'inline-flex' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {show && pos && createPortal(
        <span style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.03em',
          padding: '3px 8px',
          borderRadius: '6px',
          background: 'rgba(20,15,30,0.92)',
          color: '#ccc',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease',
          zIndex: 9999,
        }}>
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}

/* ── Check if browser has cached an image ── */
function isImageCached(url) {
  if (!url || url === 'error') return false;
  const img = new Image();
  img.src = url;
  return img.complete;
}

/* ── Composing placeholder shown while waiting for image ── */
export function SceneComposing({ sceneNumber, displayIndex, scale = 1 }) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scene badge */}
      <div className="flex items-center gap-2" style={{ marginBottom: `${8 * scale}px`, flexShrink: 0 }}>
        <span
          className="font-bold uppercase tracking-widest rounded-full"
          style={{
            fontSize: `${9 * scale}px`,
            padding: `${3 * scale}px ${8 * scale}px`,
            background: 'var(--accent-primary-soft)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--glass-border-accent)',
          }}
        >
          Scene {displayIndex ?? sceneNumber}
        </span>
        <span
          className="tracking-wide"
          style={{ fontSize: `${9 * scale}px`, color: 'var(--text-muted)' }}
        >
          composing...
        </span>
      </div>

      {/* Image skeleton area */}
      <div
        className="w-full rounded-lg relative overflow-hidden"
        style={{
          flex: '0 0 35%',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 30% 50%, var(--accent-primary-soft) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 50%, var(--accent-secondary-soft) 0%, transparent 60%)
            `,
          }}
        />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer, rgba(255,255,255,0.06)) 40%, var(--skeleton-shimmer-peak, rgba(255,255,255,0.1)) 50%, var(--skeleton-shimmer, rgba(255,255,255,0.06)) 60%, transparent 100%)',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{
              width: `${36 * scale}px`,
              height: `${36 * scale}px`,
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
              boxShadow: 'var(--shadow-glow-primary)',
              animation: 'pulse 2.5s ease-in-out infinite',
              marginBottom: `${8 * scale}px`,
            }}
          >
            <svg
              width={16 * scale} height={16 * scale} viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <span
            className="font-medium tracking-wide"
            style={{ fontSize: `${10 * scale}px`, color: 'var(--text-secondary)' }}
          >
            Painting scene
          </span>
        </div>
      </div>

      {/* Text skeleton lines */}
      <div className="flex-1 flex flex-col justify-center gap-1.5" style={{ marginTop: `${8 * scale}px` }}>
        {[100, 95, 88, 70, 60].map((w, i) => (
          <div
            key={i}
            className="rounded-full scene-skeleton-line"
            style={{
              width: `${w}%`,
              height: `${Math.max(6, 8 * scale)}px`,
              animation: `skeletonTextPulse 2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Strip markdown formatting from story text ── */
function cleanText(text) {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1');
}

/* ── Custom hook for audio playback (only-one-at-a-time logic) ── */
function useCompactAudio(src) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const playingRef = useRef(false);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onEnded = () => { setPlaying(false); setProgress(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  useEffect(() => {
    const onOtherPlay = (e) => {
      if (e.detail !== instanceId.current && playingRef.current) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener('storyforge:audio:play', onOtherPlay);
    return () => window.removeEventListener('storyforge:audio:play', onOtherPlay);
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent('storyforge:audio:play', { detail: instanceId.current }));
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  return { audioRef, playing, progress, togglePlay };
}

/* ── Revealed scene with cinematic animation ── */
function SceneRevealed({ scene, scale = 1, displayIndex, isBookmarked }) {
  const { regenImage, regenScene, deleteScene, sceneBusy, isReadOnly } = useSceneActions();
  const isBusy = sceneBusy.has(scene.scene_number);

  const isError = scene.image_url === 'error';
  const cached = isError || isImageCached(scene.image_url);
  // Hydrated / library-opened scenes skip all reveal animations
  const preloaded = scene._preloaded || false;
  const skipInitial = cached || preloaded;

  const [imageLoaded, setImageLoaded] = useState(cached);
  const [imageFailed, setImageFailed] = useState(false);
  const [showText, setShowText] = useState(skipInitial);
  const hasAnimated = useRef(skipInitial);

  const showError = isError || imageFailed;

  useEffect(() => {
    if (showText && !hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, [showText]);

  // Show text when: image loaded, image errored, or no image URL to wait for
  const noImage = !scene.image_url && !isError;

  useEffect(() => {
    if (imageLoaded || showError || noImage) {
      if (hasAnimated.current) {
        setShowText(true);
        return;
      }
      const timer = setTimeout(() => setShowText(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, showError, noImage]);

  // Reset image state when URL changes (e.g. regen)
  const prevImageUrl = useRef(scene.image_url);
  const wasRegenerated = useRef(false);
  useEffect(() => {
    if (scene.image_url && scene.image_url !== prevImageUrl.current) {
      // Only mark as regen if we had a previous image (not initial load)
      wasRegenerated.current = !!prevImageUrl.current;
      prevImageUrl.current = scene.image_url;
      setImageLoaded(false);
      setImageFailed(false);
    }
  }, [scene.image_url]);

  useEffect(() => {
    if (scene.image_url && !isError && !imageLoaded && !imageFailed) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageFailed(true);
      img.src = scene.image_url;
    }
  }, [scene.image_url, isError, imageLoaded, imageFailed]);

  // Track text changes for regen animation
  const prevText = useRef(scene.text);
  const [textRegenKey, setTextRegenKey] = useState(0);
  const textWasRegenerated = useRef(false);
  useEffect(() => {
    if (scene.text && scene.text !== prevText.current && prevText.current) {
      textWasRegenerated.current = true;
      setTextRegenKey((k) => k + 1);
    }
    prevText.current = scene.text;
  }, [scene.text]);

  const clean = cleanText(scene.text);
  const sentences = clean.match(/[^.!?]+[.!?]+[\s]*/g) || [clean];
  const firstChar = clean.charAt(0);
  const restOfFirstSentence = sentences[0]?.slice(1) || '';
  const remainingSentences = sentences.slice(1);

  const isRegen = textWasRegenerated.current;
  const skip = hasAnimated.current && !isRegen;
  const animateText = (showText && !hasAnimated.current) || isRegen;

  // Audio hook — always called (Rules of Hooks), guarded by src presence in render
  const audio = useCompactAudio(scene.audio_url);

  return (
    <div
      className={preloaded ? 'scene-preloaded-fadein' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(skip && !preloaded ? {} : preloaded ? {} : { animation: 'sceneReveal 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }),
      }}
    >
      {/* Hidden audio element */}
      {scene.audio_url && (
        <audio ref={audio.audioRef} src={scene.audio_url} preload="metadata" style={{ display: 'none' }} />
      )}

      {/* Page number + Scene badge + audio button + scene actions */}
      <div style={{ marginBottom: `${6 * scale}px`, flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: `${10 * scale}px`,
              fontStyle: 'italic',
              color: 'var(--text-muted)',
              opacity: 0.5,
              fontVariantNumeric: 'tabular-nums',
              minWidth: `${12 * scale}px`,
            }}
          >
            {displayIndex ?? scene.scene_number}
          </span>
          <span
            className="font-bold uppercase tracking-widest rounded-full"
            style={{
              fontSize: `${9 * scale}px`,
              padding: `${3 * scale}px ${8 * scale}px`,
              background: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--glass-border-accent)',
            }}
          >
            Scene {displayIndex ?? scene.scene_number}
          </span>
          {isBookmarked && (
            <span
              style={{
                color: '#d4a850',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.85,
              }}
              title="Bookmarked"
            >
              <svg width={13 * scale} height={13 * scale} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
          )}
          {scene.audio_url && (
            <button
              onClick={audio.togglePlay}
              style={{
                width: `${20 * scale}px`,
                height: `${20 * scale}px`,
                borderRadius: '50%',
                border: 'none',
                background: audio.playing ? 'var(--accent-primary)' : 'var(--accent-primary-soft)',
                color: audio.playing ? 'var(--text-inverse)' : 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: audio.playing ? '0 0 10px var(--accent-primary-glow)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {audio.playing ? (
                <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          )}
          {/* Scene actions — in header row, right-aligned */}
          {!isReadOnly && !isBusy && (
            <div
              className="scene-external-actions"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: `${3 * scale}px`,
                alignItems: 'center',
              }}
            >
              <ActionBtn label="Regenerate scene">
                <button
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); regenScene?.(scene.scene_number, scene.text); }}
                  style={{
                    width: `${18 * scale}px`,
                    height: `${18 * scale}px`,
                    borderRadius: '50%',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    touchAction: 'manipulation',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-bg-strong)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </ActionBtn>
              <ActionBtn label="Delete scene">
                <button
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); deleteScene?.(scene.scene_number); }}
                  style={{
                    width: `${18 * scale}px`,
                    height: `${18 * scale}px`,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,100,100,0.15)',
                    background: 'rgba(120,20,20,0.25)',
                    color: '#ff9999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    touchAction: 'manipulation',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(160,30,30,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(120,20,20,0.25)'; }}
                >
                  <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </ActionBtn>
            </div>
          )}
        </div>
        {scene.scene_title && (
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: `${11 * scale}px`,
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              letterSpacing: '0.02em',
              marginTop: `${3 * scale}px`,
              marginLeft: `${12 * scale + 8}px`,
            }}
          >
            {scene.scene_title}
          </div>
        )}
        {/* Audio progress bar — shown when playing */}
        {audio.playing && (
          <div
            style={{
              marginTop: `${4 * scale}px`,
              height: `${2 * scale}px`,
              background: 'var(--glass-border)',
              borderRadius: `${1 * scale}px`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${audio.progress}%`,
                background: 'var(--accent-primary)',
                boxShadow: '0 0 4px var(--accent-primary-glow)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        )}
      </div>

      {/* Image — constrained to ~35% of page, or collapsed when unavailable */}
      {showError || (preloaded && !scene.image_url) ? (
        /* Collapsed: subtle inline indicator instead of big empty box */
        <div
          className="flex items-center gap-1.5 rounded-md"
          style={{
            flexShrink: 0,
            marginBottom: `${6 * scale}px`,
            padding: `${4 * scale}px ${8 * scale}px`,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <svg
            width={12 * scale} height={12 * scale} viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.5 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: `${8 * scale}px`, color: 'var(--text-muted)', opacity: 0.6 }}>
            {scene.image_error_reason === 'quota_exhausted'
              ? 'Image quota reached'
              : scene.image_error_reason === 'safety_filter'
              ? 'Image blocked by safety filter'
              : scene.image_error_reason === 'timeout'
              ? 'Image timed out'
              : 'Illustration unavailable'}
          </span>
        </div>
      ) : (
      <div
        className="scene-image-wrap rounded-lg overflow-hidden"
        style={{
          flex: '0 0 35%',
          flexShrink: 0,
          marginBottom: `${6 * scale}px`,
          background: 'var(--book-page-bg)',
          position: 'relative',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
          <>
            {/* Shimmer placeholder while image loads / generates */}
            {!imageLoaded && (
              <div
                className="absolute inset-0"
                style={{
                  background: 'var(--glass-bg)',
                  zIndex: 1,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(ellipse at 30% 50%, var(--accent-primary-soft) 0%, transparent 60%),
                      radial-gradient(ellipse at 70% 50%, var(--accent-secondary-soft) 0%, transparent 60%)
                    `,
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                    animation: 'shimmer 2s ease-in-out infinite',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <div
                    className="rounded-lg flex items-center justify-center"
                    style={{
                      width: `${32 * scale}px`,
                      height: `${32 * scale}px`,
                      background: 'var(--glass-bg-strong)',
                      border: '1px solid var(--glass-border)',
                      backdropFilter: 'var(--glass-blur)',
                      boxShadow: 'var(--shadow-glow-primary)',
                      animation: 'pulse 2.5s ease-in-out infinite',
                      marginBottom: `${6 * scale}px`,
                    }}
                  >
                    <svg
                      width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none"
                      stroke="var(--accent-primary)" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M12 19l7-7 3 3-7 7-3-3z" />
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      <path d="M2 2l7.586 7.586" />
                      <circle cx="11" cy="11" r="2" />
                    </svg>
                  </div>
                  <span
                    className="font-medium tracking-wide"
                    style={{ fontSize: `${9 * scale}px`, color: 'var(--text-secondary)' }}
                  >
                    Painting scene
                  </span>
                </div>
              </div>
            )}
            {scene.image_url && scene.image_url !== 'error' && (
            <img
              src={scene.image_url}
              alt={`Scene ${displayIndex ?? scene.scene_number}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transform: 'scale(1.04)',
                opacity: imageLoaded ? 1 : 0,
                animation: skip && !wasRegenerated.current
                  ? 'none'
                  : imageLoaded
                    ? wasRegenerated.current
                      ? 'imageRegenReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'imageFadeIn 0.8s ease-out'
                    : 'none',
                position: 'relative',
                zIndex: 2,
              }}
              onAnimationEnd={() => { wasRegenerated.current = false; }}
            />
            )}
          </>

        {/* Busy overlay — shimmer + icon */}
        {isBusy && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(2px)',
              borderRadius: 'inherit',
            }}
          >
            {/* Shimmer sweep */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                  animation: 'shimmer 2s ease-in-out infinite',
                }}
              />
            </div>
            {/* Icon + label */}
            <div
              style={{
                width: `${32 * scale}px`,
                height: `${32 * scale}px`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 0 20px var(--accent-primary-glow)',
                animation: 'pulse 2s ease-in-out infinite',
                marginBottom: `${6 * scale}px`,
              }}
            >
              <svg
                width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none"
                stroke="var(--accent-primary)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <span
              style={{
                fontSize: `${9 * scale}px`,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                position: 'relative',
              }}
            >
              Regenerating...
            </span>
          </div>
        )}

        {/* Regen Image button — stays on image (only affects image) */}
        {!isReadOnly && !isBusy && (
          <div
            className="scene-action-bar"
            style={{
              position: 'absolute',
              top: `${4 * scale}px`,
              right: `${4 * scale}px`,
              zIndex: 10,
              display: 'flex',
            }}
          >
            <ActionBtn label="Regenerate image">
              <button
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); regenImage?.(scene.scene_number, scene.text); }}
                style={{
                  width: `${22 * scale}px`,
                  height: `${22 * scale}px`,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
              >
                <svg width={11 * scale} height={11 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </ActionBtn>
          </div>
        )}
      </div>
      )}


      {/* Decorative divider */}
      <div key={`divider-${textRegenKey}`} className="flex items-center gap-2" style={{ flexShrink: 0, marginBottom: `${4 * scale}px` }}>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary-glow), transparent)',
            animation: animateText ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'left',
            transform: showText || skip ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${3 * scale}px`,
            opacity: showText || skip ? 0.4 : 0,
            transition: skip ? 'none' : 'opacity 0.4s ease 0.3s',
            color: 'var(--accent-primary)',
            fontSize: `${8 * scale}px`,
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: `${5 * scale}px` }}>&#9679;</span>
          <span style={{ fontSize: `${3 * scale}px` }}>&#9679;</span>
          <span style={{ fontSize: `${5 * scale}px` }}>&#9679;</span>
        </div>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(270deg, var(--accent-primary-glow), transparent)',
            animation: animateText ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'right',
            transform: showText || skip ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />
      </div>

      {/* Story text — fills remaining space, overflow hidden with fade */}
      <div
        className="scene-text-area"
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          key={textRegenKey}
          onAnimationEnd={() => { textWasRegenerated.current = false; }}
          style={{
            fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
            color: 'var(--book-page-text, var(--text-primary))',
            lineHeight: '1.85',
            letterSpacing: '0.01em',
            fontSize: `${12 * scale}px`,
            ...(isRegen ? { animation: 'textRegenContainer 0.5s ease-out' } : {}),
          }}
        >
          {/* Drop cap */}
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: `${2.4 * scale}rem`,
              fontWeight: 700,
              float: 'left',
              lineHeight: '0.8',
              marginRight: '0.12em',
              marginTop: '0.05em',
              paddingRight: '0.02em',
              color: 'var(--accent-primary)',
              textShadow: '0 0 20px var(--accent-primary-glow)',
              animation: animateText
                ? isRegen
                  ? 'textRegenDropCap 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'dropCapReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
          >
            {firstChar}
          </span>

          <span
            style={{
              opacity: 1,
              animation: animateText
                ? isRegen
                  ? 'textRegenLine 0.5s ease-out 0.1s both'
                  : 'textRevealLine 0.6s ease-out 0.15s both'
                : 'none',
            }}
          >
            {restOfFirstSentence}
          </span>

          {remainingSentences.map((sentence, i) => (
            <span
              key={i}
              style={{
                opacity: 1,
                animation: animateText
                  ? isRegen
                    ? `textRegenLine 0.5s ease-out ${0.15 + i * 0.06}s both`
                    : `textRevealLine 0.6s ease-out ${0.25 + i * 0.08}s both`
                  : 'none',
              }}
            >
              {sentence}
            </span>
          ))}
        </div>

        {/* Fade-out at bottom if text overflows */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${24 * scale}px`,
            background: 'linear-gradient(to top, var(--book-page-bg), transparent)',
            pointerEvents: 'none',
          }}
        />
      </div>

    </div>
  );
}

/* ── Main SceneCard: decides composing vs revealed ── */
export default function SceneCard({ scene, scale = 1, displayIndex, isBookmarked }) {
  const wrapperStyle = scene._deleting
    ? { animation: 'sceneDeleteOut 0.5s ease-in forwards', height: '100%' }
    : { height: '100%' };

  // Show revealed state as soon as text is available (don't wait for image)
  const content = scene.text
    ? <SceneRevealed scene={scene} scale={scale} displayIndex={displayIndex} isBookmarked={isBookmarked} />
    : <SceneComposing sceneNumber={scene.scene_number} displayIndex={displayIndex} scale={scale} />;

  return <div style={wrapperStyle}>{content}</div>;
}
