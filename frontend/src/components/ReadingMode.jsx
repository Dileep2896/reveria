import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getTemplate } from '../data/templates';
import './reading-mode.css';

/**
 * Immersive full-screen reading mode.
 *
 * Features:
 *  - Contained image (no crop) with Ken Burns
 *  - Word-by-word narration highlighting (karaoke-style)
 *  - Pause / play toggle
 *  - Bookmark (localStorage)
 *  - Segmented progress bar
 *  - Auto-advance after narration
 */
const API_URL = (() => {
  const v = import.meta.env.VITE_API_URL;
  if (v) return v;
  const wsUrl = import.meta.env.VITE_WS_URL || '';
  if (wsUrl) return wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
  return 'http://localhost:8000';
})();

export default function ReadingMode({ scenes, storyId, idToken, onExit, onBookmarkChange, template = 'storybook' }) {
  const canBookmark = !!(idToken && storyId);

  const sessionKey = storyId ? `sf_rp_${storyId}` : null;

  // Resolve initial page: sessionStorage for guests, 0 for signed-in (Firestore load will override)
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!canBookmark && sessionKey) {
      const v = parseInt(sessionStorage.getItem(sessionKey), 10);
      return v >= 0 && v < scenes.length ? v : 0;
    }
    return 0;
  });
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [bookmarkedIndex, setBookmarkedIndex] = useState(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const animRef = useRef(null);
  const lastWordRef = useRef(-1);
  const currentIndexRef = useRef(0);
  const total = scenes.length;
  const scene = scenes[currentIndex];

  // Keep ref in sync for use in exit handler
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // ── Load bookmark from Firestore on mount → resume from it ──
  useEffect(() => {
    if (!canBookmark) return;
    fetch(`${API_URL}/api/stories/${storyId}/bookmark`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.scene_index != null && data.scene_index >= 0 && data.scene_index < scenes.length) {
          setBookmarkedIndex(data.scene_index);
          if (data.scene_index > 0) setCurrentIndex(data.scene_index);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Split text into words ──
  const words = useMemo(() => {
    const text = scene?.text || '';
    if (!text) return [];
    return text.split(/\s+/).filter(Boolean);
  }, [scene?.text]);

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= total) return;
    setVisible(false);
    setActiveWord(-1);
    lastWordRef.current = -1;
    cancelAnimationFrame(animRef.current);
    setTimeout(() => {
      setCurrentIndex(idx);
      setPaused(false);
      setTimeout(() => setVisible(true), 80);
    }, 450);
  }, [total]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const restart = useCallback(() => goTo(0), [goTo]);

  // ── Pause / Play ──
  const togglePause = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }, [paused]);

  // ── Save reading position ──
  const savePosition = useCallback((idx) => {
    if (canBookmark) {
      fetch(`${API_URL}/api/stories/${storyId}/bookmark`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ scene_index: idx }),
      }).catch(() => {});
      setBookmarkedIndex(idx);
      onBookmarkChange?.(idx);
    } else if (sessionKey) {
      sessionStorage.setItem(sessionKey, String(idx));
    }
  }, [canBookmark, sessionKey, storyId, idToken, onBookmarkChange]);

  // ── Exit: auto-save current position, then close ──
  const handleExit = useCallback(() => {
    savePosition(currentIndexRef.current);
    onExit();
  }, [savePosition, onExit]);

  // ── Manual bookmark toggle (same page = remove, different page = set) ──
  const isCurrentBookmarked = bookmarkedIndex === currentIndex;
  const toggleBookmark = useCallback(() => {
    if (!canBookmark) return;
    if (isCurrentBookmarked) {
      fetch(`${API_URL}/api/stories/${storyId}/bookmark`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch(() => {});
      setBookmarkedIndex(null);
      onBookmarkChange?.(null);
    } else {
      savePosition(currentIndex);
    }
  }, [canBookmark, isCurrentBookmarked, currentIndex, storyId, idToken, onBookmarkChange, savePosition]);

  // ── Real word timestamps from TTS (if available) ──
  const timestamps = scene?.word_timestamps || null;

  // ── Heuristic fallback: weight by word length + punctuation pauses ──
  const heuristicBoundaries = useMemo(() => {
    if (timestamps) return null; // not needed
    const weights = words.map(w => {
      let weight = w.length;
      if (/[.!?]$/.test(w)) weight += 5; // sentence-end pause
      if (/[,;:]$/.test(w)) weight += 2; // clause pause
      return weight;
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let cum = 0;
    return weights.map(w => { cum += w; return cum / total; });
  }, [words, timestamps]);

  // ── Word tracking loop (binary search over real timestamps, or heuristic) ──
  useEffect(() => {
    const el = audioRef.current;
    const count = words.length;
    if (!el || !count) return;

    lastWordRef.current = -1;

    const track = () => {
      if (!el.duration) {
        animRef.current = requestAnimationFrame(track);
        return;
      }

      const t = el.currentTime;
      let idx = 0;

      if (timestamps && timestamps.length > 0) {
        // Binary search: find the last timestamp <= current time
        let lo = 0, hi = timestamps.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (timestamps[mid].time <= t) lo = mid;
          else hi = mid - 1;
        }
        idx = lo;
      } else if (heuristicBoundaries) {
        // Heuristic: map time fraction to weighted word boundaries
        const fraction = t / el.duration;
        idx = heuristicBoundaries.findIndex(b => b >= fraction);
        if (idx === -1) idx = count - 1;
      }

      idx = Math.min(idx, count - 1);
      if (idx !== lastWordRef.current) {
        lastWordRef.current = idx;
        setActiveWord(idx);
      }
      animRef.current = requestAnimationFrame(track);
    };

    animRef.current = requestAnimationFrame(track);
    return () => cancelAnimationFrame(animRef.current);
  }, [currentIndex, words, timestamps, heuristicBoundaries]);

  // ── Auto-advance on audio end ──
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      setActiveWord(words.length - 1);
      lastWordRef.current = words.length - 1;
      timerRef.current = setTimeout(() => {
        if (currentIndex < total - 1) goNext();
      }, 2000);
    };
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('ended', onEnded);
      clearTimeout(timerRef.current);
    };
  }, [currentIndex, total, goNext, words.length]);

  // ── Play audio on scene change ──
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    setActiveWord(-1);
    lastWordRef.current = -1;
    if (scene?.audio_url) {
      el.src = scene.audio_url;
      const playWhenReady = () => {
        el.play().catch(() => {});
        el.removeEventListener('canplaythrough', playWhenReady);
      };
      el.addEventListener('canplaythrough', playWhenReady);
      setPaused(false);
    } else {
      el.pause();
      el.removeAttribute('src');
      // No audio → light up everything
      setActiveWord(words.length - 1);
      lastWordRef.current = words.length - 1;
    }
  }, [currentIndex, scene?.audio_url, words.length]);

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === ' ') { e.preventDefault(); togglePause(); }
      if (e.key === 'Escape') handleExit();
      if (e.key === 'b' || e.key === 'B') toggleBookmark();
      if (e.key === 'r' || e.key === 'R') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, togglePause, toggleBookmark, restart, handleExit]);

  const tmpl = getTemplate(template);
  const hasOverlays = tmpl.visualNarrative && scene?.text_overlays?.length > 0;
  const isVisualScene = hasOverlays && scene?.image_url && scene.image_url !== 'error';
  const hasImage = scene?.image_url && scene.image_url !== 'error';
  const hasAudio = !!scene?.audio_url;
  const kbVariant = currentIndex % 3;

  return (
    <div className="rm">

      {/* Blurred ambient background */}
      {hasImage && (
        <div
          key={`blur-${currentIndex}`}
          className={`rm-blur ${visible ? 'rm-in' : 'rm-out'}`}
          style={{ backgroundImage: `url(${scene.image_url})` }}
        />
      )}
      <div className="rm-bg-overlay" />

      {/* Top bar */}
      <div className="rm-top">
        <div className="rm-segs">
          {scenes.map((_, i) => (
            <div
              key={i}
              className={`rm-s${i < currentIndex ? ' done' : ''}${i === currentIndex ? ' now' : ''}`}
            />
          ))}
        </div>
        <div className="rm-controls">
          {hasAudio && (
            <button className="rm-btn" onClick={togglePause}
              aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              )}
            </button>
          )}
          {canBookmark && (
            <button
              className={`rm-btn${isCurrentBookmarked ? ' rm-bm' : ''}`}
              onClick={toggleBookmark} aria-label="Bookmark"
            >
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill={isCurrentBookmarked ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          )}
          {currentIndex > 0 && (
            <button className="rm-btn" onClick={restart} aria-label="Restart">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
          )}
          <button className="rm-btn" onClick={handleExit} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="rm-body">
        {isVisualScene ? (
          /* Visual narrative: image with text overlays */
          <div className={`rm-img-wrap rm-vn-wrap ${visible ? 'rm-in' : 'rm-out'}`} style={{ flex: '1 1 auto' }}>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
              <img
                key={currentIndex}
                src={scene.image_url}
                alt={scene.scene_title || ''}
                className={`rm-img rm-kb-${kbVariant}`}
                draggable={false}
              />
              {/* Text overlays */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {scene.text_overlays.map((ov, i) => {
                  const os = tmpl.overlayStyle || {};
                  const isDialog = ov.type === 'dialog';
                  const bg = isDialog ? (os.dialogBg || 'rgba(255,255,255,0.94)') : (os.narrationBg || 'rgba(255,220,80,0.92)');
                  const border = isDialog ? (os.dialogBorder || '#1a1a1a') : (os.narrationBorder || 'rgba(180,140,0,0.5)');
                  const color = isDialog ? (os.dialogColor || '#1a1a1a') : (os.narrationColor || '#1a1a1a');
                  const weight = isDialog ? (os.dialogFontWeight || 700) : (os.fontWeight || 700);
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${ov.x}%`,
                        top: `${ov.y}%`,
                        width: `${ov.width}%`,
                        minHeight: `${ov.height}%`,
                        padding: '4px 6px',
                        fontSize: `clamp(0.5rem, 1.4vw, 0.85rem)`,
                        lineHeight: 1.3,
                        fontFamily: "'Outfit', sans-serif",
                        fontWeight: weight,
                        textTransform: (os.uppercase && !isDialog) ? 'uppercase' : 'none',
                        letterSpacing: !isDialog ? '0.04em' : 'normal',
                        color,
                        background: bg,
                        border: `1.5px solid ${border}`,
                        borderRadius: isDialog ? '12px' : '2px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                      }}
                    >
                      {ov.text}
                      {isDialog && ov.tail_x != null && ov.tail_y != null && (
                        <svg
                          style={{
                            position: 'absolute',
                            bottom: '-10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '16px',
                            height: '12px',
                            overflow: 'visible',
                          }}
                          viewBox="0 0 16 12"
                        >
                          <polygon
                            points="3,0 13,0 8,12"
                            fill={bg}
                            stroke={border}
                            strokeWidth="1.5"
                          />
                          <rect x="3" y="-0.5" width="10" height="2" fill={bg} />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Standard: image + karaoke text */
          <>
            {/* Contained image */}
            <div className={`rm-img-wrap ${visible ? 'rm-in' : 'rm-out'}`}>
              {hasImage && (
                <img
                  key={currentIndex}
                  src={scene.image_url}
                  alt={scene.scene_title || ''}
                  className={`rm-img rm-kb-${kbVariant}`}
                  draggable={false}
                />
              )}
              {!hasImage && (
                <div className="rm-img-ph">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
                    strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Text with word-by-word highlighting */}
            <div className={`rm-text-area ${visible ? 'rm-in' : 'rm-out'}`}>
              {scene?.scene_title && (
                <h2 className="rm-title">{scene.scene_title}</h2>
              )}
              <p className="rm-text">
                {words.map((w, i) => (
                  <span
                    key={i}
                    className={
                      i < activeWord ? 'rm-w rm-past' :
                      i === activeWord ? 'rm-w rm-now' :
                      'rm-w'
                    }
                  >{w} </span>
                ))}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="rm-bottom">
        <button className="rm-nav-btn" onClick={goPrev}
          disabled={currentIndex === 0} aria-label="Previous">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="rm-counter">{currentIndex + 1} of {total}</span>
        <button className="rm-nav-btn" onClick={goNext}
          disabled={currentIndex === total - 1} aria-label="Next">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <audio ref={audioRef} preload="auto" style={{ display: 'none' }} />
    </div>
  );
}
