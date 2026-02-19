import { useState, useEffect, useRef, useCallback, forwardRef, memo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import './storybook.css';
import SceneCard from './SceneCard';

/* ============================================
   Page wrappers — must use forwardRef for
   react-pageflip to work.
   We use a single ContentPage for ALL slots so
   the DOM element count never changes (prevents
   react-pageflip ↔ React reconciliation conflicts).
   ============================================ */

const CoverPage = forwardRef(function CoverPage({ onGenreClick }, ref) {
  return (
    <div ref={ref} className="book-page book-page-cover">
      <div className="book-cover-inner-frame" />
      <div className="book-cover-content">
        <div className="book-cover-icon">
          <svg
            width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent-primary)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <h2 className="book-cover-title">Begin Your Story</h2>
        <div className="book-cover-ornament" />
        <p className="book-cover-subtitle">
          Describe a scenario like a mystery, a bedtime tale, or a historical
          event and watch it come alive with images, narration, and music.
        </p>
        <div className="book-cover-genres">
          {['Mystery', 'Fantasy', 'Sci-Fi', 'Horror', "Children's"].map((g) => (
            <button
              key={g}
              className="book-cover-genre"
              onClick={() => onGenreClick?.(GENRE_PROMPTS[g])}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

const ContentPage = forwardRef(function ContentPage({ scene, isGenerating, isWithinSpread, pageNum, scale }, ref) {
  // Pages within an active spread show as parchment; pages beyond are invisible
  const showAsPage = scene || isGenerating || isWithinSpread;

  return (
    <div ref={ref} className={showAsPage ? `book-page ${pageNum % 2 === 1 ? 'book-page-left' : 'book-page-right'}` : 'book-page-slot'}>
      {scene ? (
        <div className="book-page-inner">
          <SceneCard scene={scene} scale={scale || 1} />
        </div>
      ) : isGenerating ? (
        <GeneratingContent />
      ) : null}
    </div>
  );
});

/* Fixed slot count: 21 content pages + 1 cover = 22 total (even).
   showCover makes first & last pages hard covers.
   Internal pages: 20 pages = 10 spreads. Supports up to ~10 continuations. */
const PAGE_SLOTS = 21;
const ASPECT = 3 / 4; // width:height per page

/* ============================================
   Main StoryCanvas
   ============================================ */
const GENRE_PROMPTS = {
  'Mystery': 'A mysterious noir detective story set in a rain-soaked city at midnight...',
  'Fantasy': 'An epic fantasy adventure in a realm where ancient magic is awakening...',
  'Sci-Fi': 'A thrilling science fiction tale aboard a deep-space exploration vessel...',
  'Horror': 'A chilling horror story in an abandoned mansion where shadows move on their own...',
  "Children's": 'A whimsical bedtime story about a curious little fox exploring an enchanted forest...',
};

function StoryCanvas({ scenes, generating, userPrompt, error, onGenreClick, onPageChange }) {
  const bookRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevGenerating = useRef(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [bookSize, setBookSize] = useState({ w: 360, h: 480 });

  /* ── Responsive: measure actual wrapper space ── */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      // Reserve space for dots bar (~16) + small gap (~14)
      const availH = ch - 30;
      // Spread = 2 pages side by side, leave some horizontal breathing room
      const availW = cw - 32;

      // Size from height constraint (no upper cap — fills available space)
      const hFromH = Math.max(280, availH);
      const wFromH = Math.round(hFromH * ASPECT);

      // Size from width constraint (each page = half the spread)
      const wFromW = Math.floor(availW / 2);

      // Pick whichever is smaller so the book fits both ways
      const w = Math.min(wFromH, wFromW);
      const h = Math.round(w / ASPECT);
      setBookSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasComposing = scenes.some((s) => s.image_url === null);
  const showGenerating = generating && !hasComposing;

  /* ── Helper: find the left page of the spread containing pageIndex ── */
  // With showCover, cover=0 is solo. Then spreads are [1,2], [3,4], [5,6]...
  // Left page of a spread is always odd. flip() to an odd number is safest.
  const spreadLeftPage = (pageIndex) => {
    if (pageIndex <= 0) return 0;
    return pageIndex % 2 === 0 ? pageIndex - 1 : pageIndex;
  };

  /* ── Auto-advance: flip ONCE when continuation starts ── */
  // First story: startPage={1} handles it (no flip needed).
  // Continuation: flip to the spread where new scenes will appear.
  useEffect(() => {
    if (generating && !prevGenerating.current && scenes.length > 0 && bookRef.current) {
      const targetPage = spreadLeftPage(scenes.length + 1);
      setTimeout(() => {
        try { bookRef.current.pageFlip().flip(targetPage); } catch {}
      }, 200);
    }
    prevGenerating.current = generating;
  }, [generating, scenes.length]);

  // Last page index that has real content (cover=0, scenes=1..N, generating=N+1)
  const lastFilledPage = showGenerating ? scenes.length + 1 : scenes.length;
  // Round up to even so the spread is complete
  const maxPage = lastFilledPage + (lastFilledPage % 2 !== 0 ? 1 : 0);

  /* ── Track current page + clamp to content ── */
  const onFlip = useCallback((e) => {
    const page = e.data;
    setCurrentPage(page);
    // If user swiped/dragged past content, bounce back (instant, no animation)
    if (page > maxPage && bookRef.current) {
      const target = spreadLeftPage(maxPage);
      setTimeout(() => {
        try { bookRef.current.pageFlip().turnToPage(target); } catch {}
      }, 0);
    }
    // If user navigated back to cover but there are scenes, bounce to first spread
    if (page === 0 && scenes.length > 0 && bookRef.current) {
      setTimeout(() => {
        try { bookRef.current.pageFlip().turnToPage(1); } catch {}
      }, 0);
    }
  }, [maxPage, scenes.length]);

  /* ── Navigation — clamp to content pages ── */
  const goNext = useCallback(() => {
    if (!bookRef.current) return;
    const cur = bookRef.current.pageFlip().getCurrentPageIndex();
    // In spread mode, flipNext jumps 2 pages. Block if next spread is past content.
    if (cur + 2 > maxPage) return;
    bookRef.current.pageFlip().flipNext();
  }, [maxPage]);

  const goPrev = useCallback(() => {
    if (!bookRef.current) return;
    const cur = bookRef.current.pageFlip().getCurrentPageIndex();
    // Don't go back to cover when there are scenes
    if (cur <= 1 && scenes.length > 0) return;
    bookRef.current.pageFlip().flipPrev();
  }, [scenes.length]);

  const goTo = useCallback((spreadIndex) => {
    if (!bookRef.current) return;
    // Spread 0 = cover (page 0), spread 1 = pages [1,2], spread 2 = pages [3,4]...
    const pageIndex = spreadIndex === 0 ? 0 : (spreadIndex - 1) * 2 + 1;
    if (pageIndex > maxPage) return;
    // Don't navigate to cover when there are scenes
    if (pageIndex === 0 && scenes.length > 0) return;
    bookRef.current.pageFlip().flip(pageIndex);
  }, [maxPage, scenes.length]);

  /* ── Keyboard (skip when user is typing in an input/textarea) ── */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  /* ── Notify parent of current scene ── */
  useEffect(() => {
    if (!onPageChange) return;
    if (currentPage === 0) {
      onPageChange(null);
    } else {
      // page N = scene number N (1-indexed)
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange]);

  /* ── Navigation dots ── */
  const lastContentIndex = showGenerating ? scenes.length + 1 : scenes.length;
  const contentForDots = Math.max(lastContentIndex, 0);
  const paddedContent = contentForDots % 2 !== 0 ? contentForDots + 1 : contentForDots;
  const spreadIndex = currentPage === 0 ? 0 : Math.ceil(currentPage / 2);
  const dotCount = Math.max(1, 1 + Math.ceil(paddedContent / 2));

  /* ── Scale factor for responsive text (1.0 at max 640px height) ── */
  const pageScale = bookSize.h / 640;

  /* ── Build fixed page array ── */
  const pages = [
    <CoverPage key="cover" onGenreClick={onGenreClick} />,
    ...Array.from({ length: PAGE_SLOTS }, (_, i) => {
      const pageIndex = i + 1;
      return (
        <ContentPage
          key={`slot-${i}`}
          scene={i < scenes.length ? scenes[i] : null}
          isGenerating={i === scenes.length && showGenerating}
          isWithinSpread={pageIndex <= maxPage}
          pageNum={pageIndex}
          scale={pageScale}
        />
      );
    }),
  ];

  const hasContent = scenes.length > 0 || generating;

  return (
    <div className="storybook-wrapper" ref={wrapperRef} style={{ '--page-scale': pageScale }}>
      {error && (
        <div className="book-error-toast">
          <p>{error}</p>
        </div>
      )}

      {!hasContent ? (
        /* ── Idle: closed book + instructions ── */
        <div className="book-idle">
          <div className="book-page book-page-cover book-idle-cover" style={{ width: bookSize.w, height: bookSize.h }}>
            <div className="book-cover-inner-frame" />
            <div className="book-cover-content">
              <div className="book-cover-icon">
                <svg
                  width="34" height="34" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-primary)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <h2 className="book-cover-title">Begin Your Story</h2>
              <div className="book-cover-ornament" />
              <p className="book-cover-subtitle">
                Describe a scenario like a mystery, a bedtime tale, or a historical
                event and watch it come alive with images, narration, and music.
              </p>
              <div className="book-cover-genres">
                {['Mystery', 'Fantasy', 'Sci-Fi', 'Horror', "Children's"].map((g) => (
                  <button
                    key={g}
                    className="book-cover-genre"
                    onClick={() => onGenreClick?.(GENRE_PROMPTS[g])}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="book-idle-hint">
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Type a story idea below and press Create to begin</span>
          </div>
        </div>
      ) : (
        /* ── Active: flipbook with overlay nav ── */
        <div className="storybook-container">
          {/* Left arrow overlay */}
          <button
            className="book-nav-overlay book-nav-overlay-left"
            onClick={goPrev}
            disabled={currentPage <= (scenes.length > 0 ? 1 : 0)}
            aria-label="Previous page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <HTMLFlipBook
            ref={bookRef}
            width={bookSize.w}
            height={bookSize.h}
            size="fixed"
            showCover={true}
            startPage={1}
            drawShadow={true}
            maxShadowOpacity={0.5}
            flippingTime={800}
            usePortrait={false}
            startZIndex={0}
            autoSize={true}
            mobileScrollSupport={true}
            disableFlipByClick={true}
            clickEventForward={true}
            useMouseEvents={false}
            swipeDistance={30}
            onFlip={onFlip}
            className="storybook"
          >
            {pages}
          </HTMLFlipBook>

          {/* Right arrow overlay */}
          <button
            className="book-nav-overlay book-nav-overlay-right"
            onClick={goNext}
            disabled={currentPage + 2 > maxPage}
            aria-label="Next page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Dots-only bar (no arrows) */}
      {dotCount > 1 && (
        <div className="book-nav-dots-bar">
          {Array.from({ length: dotCount }, (_, i) => (
            i < (scenes.length > 0 ? 1 : 0) ? null : (
              <button
                key={i}
                className={`book-nav-dot${i === spreadIndex ? ' active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to spread ${i + 1}`}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Generating content ── */
function GeneratingContent() {
  const steps = [
    { label: 'Writing narrative', delay: 0 },
    { label: 'Generating illustrations', delay: 0.3 },
    { label: 'Composing scenes', delay: 0.6 },
  ];

  return (
    <div className="book-generating">
      <div className="book-generating-icon">
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent-primary)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </div>
      <h3 className="book-generating-title">Crafting your story...</h3>
      <p className="book-generating-subtitle">Weaving narrative and composing scenes</p>
      <div className="book-generating-steps">
        {steps.map(({ label, delay }, i) => (
          <div
            key={label}
            className="book-generating-step"
            style={{ animation: `fadeIn 0.5s ease-out ${delay}s both` }}
          >
            <div className="book-generating-dots">
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100}ms` }} />
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100 + 150}ms` }} />
              <div className="book-generating-dot" style={{ animationDelay: `${i * 100 + 300}ms` }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(StoryCanvas);
