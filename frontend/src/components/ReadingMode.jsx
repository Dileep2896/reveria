import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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

export default function ReadingMode({ scenes, storyId, idToken, onExit, onBookmarkChange }) {
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
      el.play().catch(() => {});
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

  const hasImage = scene?.image_url && scene.image_url !== 'error';
  const hasAudio = !!scene?.audio_url;
  const kbVariant = currentIndex % 3;

  return (
    <div className="rm">
      <style>{CSS}</style>

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

const CSS = `
/* Registered custom property — enables smooth gradient animation */
@property --sweep {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.rm {
  position: fixed; inset: 0; z-index: 200;
  background: #07070a;
  display: flex; flex-direction: column;
  overflow: hidden; user-select: none;
}

/* Blurred ambient glow */
.rm-blur {
  position: absolute; inset: -60px;
  background-size: cover; background-position: center;
  filter: blur(50px) brightness(0.35) saturate(1.4);
  transition: opacity 0.6s ease;
}
.rm-blur.rm-in  { opacity: 1; }
.rm-blur.rm-out { opacity: 0; }

.rm-bg-overlay {
  position: absolute; inset: 0;
  background: rgba(7,7,10,0.55);
  pointer-events: none;
}

/* Top bar */
.rm-top {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px 0;
  z-index: 15; position: relative;
}
.rm-segs { display: flex; gap: 5px; flex: 1; }
.rm-s {
  flex: 1; height: 2.5px; border-radius: 2px;
  background: rgba(255,255,255,0.12);
  transition: background 0.4s;
}
.rm-s.done { background: rgba(255,255,255,0.55); }
.rm-s.now  {
  background: rgba(255,255,255,0.9);
  box-shadow: 0 0 6px rgba(255,255,255,0.25);
}

.rm-controls { display: flex; gap: 6px; flex-shrink: 0; }
.rm-btn {
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s;
}
.rm-btn:hover { background: rgba(255,255,255,0.12); }
.rm-bm { color: #f0c040; border-color: rgba(240,192,64,0.3); }

/* Body */
.rm-body {
  flex: 1; display: flex; flex-direction: column;
  padding: 16px 24px 8px;
  min-height: 0;
  position: relative; z-index: 5;
}

/* Contained image */
.rm-img-wrap {
  flex: 1 1 0;
  display: flex; align-items: center; justify-content: center;
  min-height: 0; overflow: hidden;
  border-radius: 14px; position: relative;
  transition: opacity 0.5s ease;
}
.rm-img-wrap.rm-in  { opacity: 1; }
.rm-img-wrap.rm-out { opacity: 0; }

.rm-img {
  max-width: 100%; max-height: 100%;
  object-fit: contain; border-radius: 12px;
  will-change: transform;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
.rm-img-ph {
  width: 100%; height: 200px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.03); border-radius: 12px;
}

/* Ken Burns */
.rm-kb-0 { animation: kb0 30s ease-in-out infinite alternate; }
.rm-kb-1 { animation: kb1 28s ease-in-out infinite alternate; }
.rm-kb-2 { animation: kb2 26s ease-in-out infinite alternate; }
@keyframes kb0 {
  0%   { transform: scale(1); }
  100% { transform: scale(1.04) translate(-0.5%, -0.3%); }
}
@keyframes kb1 {
  0%   { transform: scale(1.03) translate(-0.3%, 0.2%); }
  100% { transform: scale(1) translate(0.3%, -0.2%); }
}
@keyframes kb2 {
  0%   { transform: scale(1); }
  100% { transform: scale(1.04) translate(0.3%, 0.3%); }
}

/* Text area */
.rm-text-area {
  flex-shrink: 0;
  padding: 18px 8px 4px;
  max-width: 740px; margin: 0 auto; width: 100%;
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.rm-text-area.rm-in  { opacity: 1; transform: translateY(0); }
.rm-text-area.rm-out { opacity: 0; transform: translateY(10px); }

.rm-title {
  font-family: 'Playfair Display', 'Georgia', serif;
  font-size: 1.15rem; font-weight: 600;
  color: rgba(255,255,255,0.88);
  margin: 0 0 8px; text-align: center;
  letter-spacing: 0.02em;
}

.rm-text {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 0.92rem; line-height: 1.85;
  margin: 0; text-align: center;
}

/* ── Smooth per-letter karaoke highlight ──────────
   Uses @property --sweep to animate a gradient wipe
   across each word via background-clip: text.
   The gradient sweeps left→right through the letters. */

.rm-w {
  --sweep: 0%;
  background: linear-gradient(90deg,
    rgba(255,255,255,0.9)  calc(var(--sweep) - 8%),
    rgba(255,255,255,0.18) calc(var(--sweep) + 8%)
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: --sweep 0.55s ease-out;
}

/* Already spoken — fully lit */
.rm-w.rm-past {
  --sweep: 100%;
}

/* Current word — sweep animates 0% → 100%, soft glow via filter */
.rm-w.rm-now {
  --sweep: 100%;
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.18));
}

/* Bottom bar */
.rm-bottom {
  display: flex; align-items: center; justify-content: center; gap: 28px;
  padding: 8px 24px 18px;
  z-index: 15; position: relative;
}
.rm-counter {
  font-size: 0.7rem; font-weight: 500;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.18em; text-transform: uppercase;
  min-width: 60px; text-align: center;
}
.rm-nav-btn {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s, opacity 0.2s;
}
.rm-nav-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.8);
}
.rm-nav-btn:disabled { opacity: 0.2; cursor: default; }

/* Mobile */
@media (max-width: 640px) {
  .rm-body { padding: 10px 14px 4px; }
  .rm-text-area { padding: 12px 4px 2px; }
  .rm-title { font-size: 1rem; }
  .rm-text  { font-size: 0.85rem; line-height: 1.7; }
  .rm-bottom { padding: 6px 16px 14px; gap: 20px; }
  .rm-controls { gap: 4px; }
  .rm-btn { width: 30px; height: 30px; }
}
`;
