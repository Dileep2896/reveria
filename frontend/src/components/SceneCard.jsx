import { useState, useEffect, useRef } from 'react';

/* ── Check if browser has cached an image ── */
function isImageCached(url) {
  if (!url || url === 'error') return false;
  const img = new Image();
  img.src = url;
  return img.complete;
}

/* ── Composing placeholder shown while waiting for image ── */
export function SceneComposing({ sceneNumber, scale = 1 }) {
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
          Scene {sceneNumber}
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

/* ── Custom audio player matching glassmorphism theme ── */
function AudioPlayer({ src, scale = 1 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const playingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Audio event listeners — stable, set up once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  /* ── Only-one-at-a-time: pause when another player starts ── */
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

  const seek = (e) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  };

  const fmt = (t) => {
    if (!t || !isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        flexShrink: 0,
        marginTop: `${4 * scale}px`,
        paddingTop: `${4 * scale}px`,
        borderTop: '1px solid var(--glass-border)',
        animation: 'fadeIn 0.4s ease',
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${6 * scale}px`,
          padding: `${4 * scale}px ${6 * scale}px`,
          borderRadius: `${8 * scale}px`,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          style={{
            width: `${22 * scale}px`,
            height: `${22 * scale}px`,
            borderRadius: '50%',
            border: 'none',
            background: playing ? 'var(--accent-primary)' : 'var(--accent-primary-soft)',
            color: playing ? 'var(--text-inverse)' : 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: playing ? '0 0 10px var(--accent-primary-glow)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {playing ? (
            <svg width={10 * scale} height={10 * scale} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width={10 * scale} height={10 * scale} viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time */}
        <span style={{ fontSize: `${9 * scale}px`, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: `${28 * scale}px` }}>
          {fmt(currentTime)}
        </span>

        {/* Progress bar */}
        <div
          ref={progressBarRef}
          onClick={seek}
          style={{
            flex: 1,
            height: `${4 * scale}px`,
            borderRadius: `${2 * scale}px`,
            background: 'var(--glass-border)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${progress}%`,
              borderRadius: `${2 * scale}px`,
              background: 'var(--accent-primary)',
              boxShadow: '0 0 6px var(--accent-primary-glow)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Duration */}
        <span style={{ fontSize: `${9 * scale}px`, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: `${28 * scale}px`, textAlign: 'right' }}>
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
}

/* ── Revealed scene with cinematic animation ── */
function SceneRevealed({ scene, scale = 1 }) {
  const isError = scene.image_url === 'error';
  const cached = isError || isImageCached(scene.image_url);

  const [imageLoaded, setImageLoaded] = useState(cached);
  const [showText, setShowText] = useState(cached);
  const hasAnimated = useRef(cached);

  useEffect(() => {
    if (showText && !hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, [showText]);

  useEffect(() => {
    if (imageLoaded || isError) {
      if (hasAnimated.current) {
        setShowText(true);
        return;
      }
      const timer = setTimeout(() => setShowText(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, isError]);

  useEffect(() => {
    if (scene.image_url && !isError && !imageLoaded) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = scene.image_url;
    }
  }, [scene.image_url, isError, imageLoaded]);

  const clean = cleanText(scene.text);
  const sentences = clean.match(/[^.!?]+[.!?]+[\s]*/g) || [clean];
  const firstChar = clean.charAt(0);
  const restOfFirstSentence = sentences[0]?.slice(1) || '';
  const remainingSentences = sentences.slice(1);

  const skip = hasAnimated.current;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(skip ? {} : { animation: 'sceneReveal 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }),
      }}
    >
      {/* Page number + Scene badge */}
      <div className="flex items-center gap-2" style={{ marginBottom: `${6 * scale}px`, flexShrink: 0 }}>
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
          {scene.scene_number}
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
          Scene {scene.scene_number}
        </span>
      </div>

      {/* Image — constrained to ~35% of page */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          flex: '0 0 35%',
          flexShrink: 0,
          marginBottom: `${6 * scale}px`,
          background: 'var(--book-page-bg)',
        }}
      >
        {isError ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: 'var(--glass-bg)',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-muted)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: `${9 * scale}px`, color: 'var(--text-muted)' }}>
                Illustration unavailable
              </span>
            </div>
          </div>
        ) : (
          <img
            src={scene.image_url}
            alt={`Scene ${scene.scene_number}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: 'scale(1.04)',
              animation: skip ? 'none' : 'imageFadeIn 0.8s ease-out',
            }}
          />
        )}
      </div>

      {/* Decorative divider */}
      <div className="flex items-center gap-2" style={{ flexShrink: 0, marginBottom: `${4 * scale}px` }}>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary-glow), transparent)',
            animation: showText && !skip ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'left',
            transform: showText || skip ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />
        <svg
          width="8" height="8" viewBox="0 0 12 12"
          fill="var(--accent-primary)"
          style={{
            opacity: showText || skip ? 0.4 : 0,
            transition: skip ? 'none' : 'opacity 0.4s ease 0.3s',
          }}
        >
          <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" />
        </svg>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(270deg, var(--accent-primary-glow), transparent)',
            animation: showText && !skip ? 'dividerGrow 0.6s ease-out' : 'none',
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
          style={{
            fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
            color: 'var(--book-page-text, var(--text-primary))',
            lineHeight: '1.7',
            letterSpacing: '0.01em',
            fontSize: `${12 * scale}px`,
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
              marginRight: '0.1em',
              marginTop: '0.06em',
              color: 'var(--accent-primary)',
              textShadow: '0 0 20px var(--accent-primary-glow)',
              animation: showText && !skip ? 'dropCapReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            }}
          >
            {firstChar}
          </span>

          <span
            style={{
              opacity: 1,
              animation: showText && !skip ? 'textRevealLine 0.6s ease-out 0.15s both' : 'none',
            }}
          >
            {restOfFirstSentence}
          </span>

          {remainingSentences.map((sentence, i) => (
            <span
              key={i}
              style={{
                opacity: 1,
                animation: showText && !skip
                  ? `textRevealLine 0.6s ease-out ${0.25 + i * 0.08}s both`
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

      {scene.audio_url && (
        <AudioPlayer src={scene.audio_url} scale={scale} />
      )}
    </div>
  );
}

/* ── Main SceneCard: decides composing vs revealed ── */
export default function SceneCard({ scene, scale = 1 }) {
  const isReady = scene.image_url !== null;

  if (!isReady) {
    return <SceneComposing sceneNumber={scene.scene_number} scale={scale} />;
  }

  return <SceneRevealed scene={scene} scale={scale} />;
}
