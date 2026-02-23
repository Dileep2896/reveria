import { useState, useEffect, useRef, useCallback, forwardRef, memo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { useTheme } from '../contexts/ThemeContext';
import './storybook.css';
import SceneCard from './SceneCard';
import { GENRE_KEYS, getLangData } from '../data/languages';
import CoverPage from './storybook/CoverPage';
import EmptyPageContent from './storybook/EmptyPageContent';
import GeneratingContent from './storybook/GeneratingContent';
import useBookSize from '../hooks/useBookSize';
import useStoryNavigation, { spreadLeftPage } from '../hooks/useStoryNavigation';

const ContentPage = forwardRef(function ContentPage({ scene, isGenerating, isWithinSpread, pageNum, scale, hasScenes, displayIndex, isBookmarked }, ref) {
  const showAsPage = scene || isGenerating || isWithinSpread;
  const isEmpty = showAsPage && !scene && !isGenerating && hasScenes;

  return (
    <div ref={ref} className={showAsPage ? `book-page ${pageNum % 2 === 1 ? 'book-page-left' : 'book-page-right'}` : 'book-page-slot'}>
      {scene ? (
        <div className="book-page-inner">
          <SceneCard scene={scene} scale={scale || 1} displayIndex={displayIndex} isBookmarked={isBookmarked} />
        </div>
      ) : isGenerating ? (
        <GeneratingContent />
      ) : isEmpty ? (
        <div className="book-page-inner">
          <EmptyPageContent scale={scale || 1} />
        </div>
      ) : null}
    </div>
  );
});

const PAGE_SLOTS = 21;

function StoryCanvas({ scenes, generating, userPrompt, error, onGenreClick, onPageChange, storyId, displayPrompt, spreadPrompts, bookmarkPage, language = 'English' }) {
  const { theme } = useTheme();
  const lang = getLangData(language);
  const bookRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevGenerating = useRef(false);
  const initialPageRef = useRef(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    return p ? Math.max(1, parseInt(p, 10)) : 1;
  });
  if (typeof initialPageRef.current === 'function') initialPageRef.current = initialPageRef.current();
  const [currentPage, setCurrentPage] = useState(initialPageRef.current);
  const bookSize = useBookSize(wrapperRef);

  const hasComposing = scenes.some((s) => s.image_url === null);
  const showGenerating = generating && !hasComposing;

  /* ── Book entrance animation ── */
  const [entranceReady, setEntranceReady] = useState(false);
  const entranceTriggered = useRef(false);
  useEffect(() => {
    if ((scenes.length > 0 || generating) && !entranceTriggered.current) {
      entranceTriggered.current = true;
      requestAnimationFrame(() => setEntranceReady(true));
    }
  }, [scenes.length, generating]);

  /* ── Auto-advance during generation ── */
  const lastFlipTarget = useRef(-1);
  useEffect(() => {
    if (!bookRef.current) return;

    if (generating && !prevGenerating.current && scenes.length > 0) {
      const target = spreadLeftPage(scenes.length + 1);
      lastFlipTarget.current = target;
      setTimeout(() => {
        try { bookRef.current.pageFlip().flip(target); } catch {}
      }, 200);
    }

    if (generating && scenes.length > 0) {
      const currentIdx = bookRef.current.pageFlip().getCurrentPageIndex();
      const newScenePage = scenes.length;
      const currentSpreadEnd = currentIdx + 1;
      if (newScenePage > currentSpreadEnd) {
        const target = spreadLeftPage(newScenePage);
        if (target !== lastFlipTarget.current) {
          lastFlipTarget.current = target;
          setTimeout(() => {
            try { bookRef.current.pageFlip().flip(target); } catch {}
          }, 300);
        }
      }
    }

    if (!generating) {
      lastFlipTarget.current = -1;
    }

    prevGenerating.current = generating;
  }, [generating, scenes.length]);

  /* ── Clamp to content when page exceeds available scenes ── */
  const clampedRef = useRef(false);
  useEffect(() => {
    if (!bookSize) return;
    if (generating) return;
    const maxValid = scenes.length;
    if (maxValid === 0) {
      clampedRef.current = false;
      return;
    }
    if (currentPage <= maxValid) {
      clampedRef.current = true;
      return;
    }
    const target = spreadLeftPage(maxValid);
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        if (!bookRef.current) return;
        try { bookRef.current.pageFlip().turnToPage(target); } catch {}
        setCurrentPage(target);
        clampedRef.current = true;
      }, clampedRef.current ? 50 : 400);
    });
    return () => cancelAnimationFrame(raf);
  }, [scenes.length, currentPage, bookSize, generating]);

  /* ── Auto-flip to bookmarked page on initial load ── */
  const bookmarkFlipped = useRef(false);
  useEffect(() => {
    if (!bookmarkPage || bookmarkFlipped.current || !bookRef.current || !bookSize) return;
    if (!scenes.length) return;
    bookmarkFlipped.current = true;
    const target = spreadLeftPage(bookmarkPage);
    setTimeout(() => {
      try { bookRef.current.pageFlip().flip(target); } catch {}
    }, 400);
  }, [bookmarkPage, bookSize, scenes.length]);

  const lastFilledPage = showGenerating ? scenes.length + 1 : scenes.length;
  const maxPage = lastFilledPage + (lastFilledPage % 2 !== 0 ? 1 : 0);

  const { onFlip, goNext, goPrev, goTo } = useStoryNavigation({
    bookRef, currentPage, setCurrentPage, maxPage, scenes, storyId, onPageChange,
  });

  /* ── Navigation dots ── */
  const lastContentIndex = showGenerating ? scenes.length + 1 : scenes.length;
  const contentForDots = Math.max(lastContentIndex, 0);
  const paddedContent = contentForDots % 2 !== 0 ? contentForDots + 1 : contentForDots;
  const spreadIndex = currentPage === 0 ? 0 : Math.ceil(currentPage / 2);
  const dotCount = Math.max(1, 1 + Math.ceil(paddedContent / 2));

  const pageScale = bookSize ? bookSize.h / 640 : 1;

  /* ── Build fixed page array ── */
  const pages = [
    <CoverPage key="cover" onGenreClick={onGenreClick} lang={lang} />,
    ...Array.from({ length: PAGE_SLOTS }, (_, i) => {
      const pageIndex = i + 1;
      return (
        <ContentPage
          key={`slot-${i}`}
          scene={i < scenes.length ? scenes[i] : null}
          displayIndex={i < scenes.length ? i + 1 : undefined}
          isGenerating={i === scenes.length && showGenerating}
          isWithinSpread={pageIndex <= maxPage}
          pageNum={pageIndex}
          scale={pageScale}
          hasScenes={scenes.length > 0}
          isBookmarked={!!(bookmarkPage && i + 1 === bookmarkPage)}
        />
      );
    }),
  ];

  const hasContent = scenes.length > 0 || generating;

  if (!bookSize) {
    return <div className="storybook-wrapper" ref={wrapperRef} />;
  }

  return (
    <div className="storybook-wrapper" ref={wrapperRef} style={{ '--page-scale': pageScale }}>
      {!hasContent ? (
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
              <h2 className="book-cover-title">{lang.title}</h2>
              <div className="book-cover-ornament" />
              <p className="book-cover-subtitle">{lang.subtitle}</p>
              <div className="book-cover-genres">
                {GENRE_KEYS.map((g) => (
                  <button
                    key={g}
                    className="book-cover-genre"
                    onClick={() => onGenreClick?.(lang.genres[g].prompt)}
                  >
                    {lang.genres[g].label}
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
            <span>{lang.hint}</span>
          </div>
        </div>
      ) : (
        <>
        {displayPrompt && (() => {
          const leftPrompt = spreadPrompts?.left || displayPrompt;
          const rightPrompt = spreadPrompts?.right;
          const showTwo = rightPrompt && rightPrompt !== leftPrompt;
          const pillIcon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          );
          return (
            <div className={showTwo ? "book-prompt-pills" : undefined}>
              <div className="book-prompt-pill" title={leftPrompt}>
                {pillIcon}
                <p>{leftPrompt}</p>
              </div>
              {showTwo && (
                <div className="book-prompt-pill" title={rightPrompt}>
                  {pillIcon}
                  <p>{rightPrompt}</p>
                </div>
              )}
            </div>
          );
        })()}
        <div className={`storybook-container${!entranceReady ? ' storybook-entering' : ' storybook-entrance'}`}>
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
            startPage={initialPageRef.current}
            drawShadow={true}
            maxShadowOpacity={theme === 'light' ? 0.12 : 0.5}
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
        </>
      )}

      {dotCount > 1 && (() => {
        const bookmarkSpread = bookmarkPage ? Math.ceil(bookmarkPage / 2) : null;
        return (
          <div className="book-nav-dots-bar">
            {Array.from({ length: dotCount }, (_, i) => (
              i < (scenes.length > 0 ? 1 : 0) ? null : (
                <button
                  key={i}
                  className={`book-nav-dot${i === spreadIndex ? ' active' : ''}${i === bookmarkSpread ? ' bookmarked' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to spread ${i + 1}${i === bookmarkSpread ? ' (bookmarked)' : ''}`}
                />
              )
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default memo(StoryCanvas);
