import { useState, useEffect, useLayoutEffect, useRef, forwardRef, memo, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { useTheme } from '../contexts/ThemeContext';
import gsap from 'gsap';
import './storybook.css';
import SceneCard from './SceneCard';
import { getLangData } from '../data/languages';
import CoverPage from './storybook/CoverPage';
import EmptyPageContent from './storybook/EmptyPageContent';
import GeneratingContent from './storybook/GeneratingContent';
import TemplateChooser, { BookCover } from './TemplateChooser';
import useBookSize from '../hooks/useBookSize';
import useStoryNavigation, { spreadLeftPage } from '../hooks/useStoryNavigation';

const ContentPage = forwardRef(function ContentPage({ scene, isGenerating, isWithinSpread, pageNum, scale, hasScenes, displayIndex, isBookmarked, singlePage, nextChapter, template }, ref) {
  const showAsPage = scene || isGenerating || isWithinSpread;
  const isEmpty = showAsPage && !scene && !isGenerating && hasScenes;

  return (
    <div ref={ref} className={showAsPage ? `book-page ${pageNum % 2 === 1 ? 'book-page-left' : 'book-page-right'}` : 'book-page-slot'}>
      {scene ? (
        <div className="book-page-inner">
          <SceneCard scene={scene} scale={scale || 1} displayIndex={displayIndex} isBookmarked={isBookmarked} singlePage={singlePage} template={template} />
        </div>
      ) : isGenerating ? (
        <GeneratingContent />
      ) : isEmpty ? (
        <div className="book-page-inner">
          <EmptyPageContent scale={scale || 1} nextChapter={nextChapter} />
        </div>
      ) : null}
    </div>
  );
});

const MIN_PAGE_SLOTS = 21;

function StoryCanvas({ scenes, generating, onPageChange, storyId, displayPrompt, spreadPrompts, bookmarkPage, language = 'English', onLanguageChange, singlePage = false, template = 'storybook', onTemplateSelect, onTemplateBack }) {
  const { theme } = useTheme();
  const lang = getLangData(language);
  const bookRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevGenerating = useRef(false);
  const [expandedPrompt, setExpandedPrompt] = useState(null);
  const initialPageRef = useRef(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    if (p) return Math.max(1, parseInt(p, 10));
    return /^\/story\//.test(window.location.pathname) ? 1 : 0;
  });
  if (typeof initialPageRef.current === 'function') initialPageRef.current = initialPageRef.current();
  const [currentPage, setCurrentPage] = useState(initialPageRef.current);
  const bookSize = useBookSize(wrapperRef, singlePage);

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
  const scenesAtGenStart = useRef(0);
  const firstGenFlipDone = useRef(false);
  useEffect(() => {
    if (!bookRef.current) return;

    // Track how many scenes existed when generation started
    if (generating && !prevGenerating.current) {
      scenesAtGenStart.current = scenes.length;
      firstGenFlipDone.current = false;
    }

    const isFirstGen = scenesAtGenStart.current === 0;

    // ── First generation: cover → first scene flip ──
    if (generating && isFirstGen && !firstGenFlipDone.current && scenes.length > 0) {
      firstGenFlipDone.current = true;
      const target = singlePage ? 1 : 1;
      lastFlipTarget.current = target;
      // 800ms delay lets the 700ms entrance animation finish
      setTimeout(() => {
        try { bookRef.current.pageFlip().flip(target); } catch {}
      }, 800);
    }

    // ── First generation, scene 2+: flip to new scene after cover flip done ──
    if (generating && isFirstGen && firstGenFlipDone.current && scenes.length > 1) {
      const target = singlePage ? scenes.length : spreadLeftPage(scenes.length);
      if (target !== lastFlipTarget.current) {
        lastFlipTarget.current = target;
        setTimeout(() => {
          try { bookRef.current.pageFlip().flip(target); } catch {}
        }, 200);
      }
    }

    // ── Subsequent generations: flip to generating page ──
    if (generating && !isFirstGen) {
      if (!prevGenerating.current && scenes.length > 0) {
        const target = singlePage ? scenes.length + 1 : spreadLeftPage(scenes.length + 1);
        lastFlipTarget.current = target;
        setTimeout(() => {
          try { bookRef.current.pageFlip().flip(target); } catch {}
        }, 200);
      }
      if (scenes.length > 0) {
        let currentIdx;
        try { currentIdx = bookRef.current.pageFlip().getCurrentPageIndex(); } catch { currentIdx = 0; }
        const newScenePage = scenes.length;
        const currentSpreadEnd = singlePage ? currentIdx : currentIdx + 1;
        if (newScenePage > currentSpreadEnd) {
          const target = singlePage ? newScenePage : spreadLeftPage(newScenePage);
          if (target !== lastFlipTarget.current) {
            lastFlipTarget.current = target;
            setTimeout(() => {
              try { bookRef.current.pageFlip().flip(target); } catch {}
            }, 300);
          }
        }
      }
    }

    if (!generating) {
      lastFlipTarget.current = -1;
    }

    prevGenerating.current = generating;
  }, [generating, scenes.length, singlePage]);

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
    const target = singlePage ? maxValid : spreadLeftPage(maxValid);
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        if (!bookRef.current) return;
        try { bookRef.current.pageFlip().turnToPage(target); } catch {}
        setCurrentPage(target);
        clampedRef.current = true;
      }, clampedRef.current ? 50 : 400);
    });
    return () => cancelAnimationFrame(raf);
  }, [scenes.length, currentPage, bookSize, generating, singlePage]);

  /* ── Auto-flip to bookmarked page on initial load ── */
  const bookmarkFlipped = useRef(false);
  useEffect(() => {
    if (!bookmarkPage || bookmarkFlipped.current || !bookRef.current || !bookSize) return;
    if (!scenes.length) return;
    bookmarkFlipped.current = true;
    const target = singlePage ? bookmarkPage : spreadLeftPage(bookmarkPage);
    setTimeout(() => {
      try { bookRef.current.pageFlip().flip(target); } catch {}
    }, 400);
  }, [bookmarkPage, bookSize, scenes.length, singlePage]);

  const lastFilledPage = showGenerating ? scenes.length + 1 : scenes.length;
  const maxPage = singlePage ? lastFilledPage : lastFilledPage + (lastFilledPage % 2 !== 0 ? 1 : 0);

  const { onFlip, goNext, goPrev, goTo } = useStoryNavigation({
    bookRef, currentPage, setCurrentPage, maxPage, scenes, storyId, onPageChange, singlePage, generating,
  });

  /* ── Navigation dots ── */
  const lastContentIndex = showGenerating ? scenes.length + 1 : scenes.length;
  const contentForDots = Math.max(lastContentIndex, 0);
  const paddedContent = contentForDots % 2 !== 0 ? contentForDots + 1 : contentForDots;
  const spreadIndex = singlePage ? currentPage : (currentPage === 0 ? 0 : Math.ceil(currentPage / 2));
  const dotCount = singlePage ? Math.max(1, 1 + contentForDots) : Math.max(1, 1 + Math.ceil(paddedContent / 2));

  const pageScale = bookSize ? bookSize.h / 640 : 1;

  /* ── Build fixed page array ── */
  const pageSlots = Math.max(MIN_PAGE_SLOTS, scenes.length + 2);
  const pages = [
    <CoverPage key="cover" lang={lang} generating={generating && scenes.length === 0} />,
    ...Array.from({ length: pageSlots }, (_, i) => {
      const pageIndex = i + 1;
      return (
        <ContentPage
          key={i < scenes.length ? `scene-${scenes[i].scene_number}` : `slot-${i}`}
          scene={i < scenes.length ? scenes[i] : null}
          displayIndex={i < scenes.length ? i + 1 : undefined}
          isGenerating={i === scenes.length && showGenerating}
          isWithinSpread={pageIndex <= maxPage}
          pageNum={pageIndex}
          scale={pageScale}
          hasScenes={scenes.length > 0}
          isBookmarked={!!(bookmarkPage && i + 1 === bookmarkPage)}
          singlePage={singlePage}
          nextChapter={scenes.length + 1}
          template={template}
        />
      );
    }),
  ];

  const hasContent = scenes.length > 0 || generating;

  /* ── Template selection transition ── */
  /* Forward: GSAP exit → save focused book rect → React swap → gsap.from() settle   */
  /* Back:    GSAP exit idle cover → React swap → chooser mounts with CSS fadeIn      */
  const [transitioning, setTransitioning] = useState(null);
  const savedRectRef = useRef(null);
  const [settleTick, setSettleTick] = useState(0);

  const handleTemplateTransition = useCallback((key) => {
    const chooser = document.querySelector('.template-chooser');
    if (chooser) gsap.set(chooser, { pointerEvents: 'none' });

    const tl = gsap.timeline();
    const header = document.querySelector('.tc-header');
    const footer = document.querySelector('.tc-footer');
    const arrowL = document.querySelector('.tc-coverflow-arrow--left');
    const arrowR = document.querySelector('.tc-coverflow-arrow--right');
    const sideItems = document.querySelectorAll('.tc-coverflow-item:not(.focused)');
    const gridItems = document.querySelectorAll('.tc-grid .tc-book:not(.selected)');
    const focusedBook = document.querySelector('.tc-coverflow-item.focused .tc-book') ||
                        document.querySelector('.tc-grid .tc-book.selected');

    // Phase 1: Surrounding UI slides out (0–300ms)
    if (header) tl.to(header, { y: -30, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
    if (footer) tl.to(footer, { y: 30, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
    if (arrowL) tl.to(arrowL, { x: -40, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
    if (arrowR) tl.to(arrowR, { x: 40, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
    if (sideItems.length) tl.to(sideItems, { opacity: 0, filter: 'blur(4px)', duration: 0.3, ease: 'power2.out' }, 0);
    if (gridItems.length) tl.to(gridItems, { opacity: 0, filter: 'blur(4px)', duration: 0.3, ease: 'power2.out' }, 0);

    // Phase 2: Focused book pulses bright then fades (100–480ms)
    if (focusedBook) {
      // Save the book's screen position before it fades
      savedRectRef.current = focusedBook.getBoundingClientRect();
      tl.to(focusedBook, { filter: 'brightness(1.4)', scale: 1.06, duration: 0.2, ease: 'power2.out' }, 0.1);
      tl.to(focusedBook, { opacity: 0, scale: 1.1, filter: 'brightness(1.6)', duration: 0.2, ease: 'power2.in' }, 0.3);
    }

    setTransitioning(key);

    // Phase 3: After exit completes, swap React state — idle cover mounts
    setTimeout(() => {
      onTemplateSelect(key);
      setTransitioning(null);
      setSettleTick(v => v + 1);
    }, 500);
  }, [onTemplateSelect]);

  // Phase 4: After idle cover mounts, animate it FROM the carousel book's last position
  // useLayoutEffect fires before browser paint — no visible gap
  useLayoutEffect(() => {
    const sourceRect = savedRectRef.current;
    if (!sourceRect || settleTick === 0) return;
    savedRectRef.current = null;

    const idleBook = document.querySelector('.tc-idle-cover .tc-book');
    if (!idleBook) return;

    const targetRect = idleBook.getBoundingClientRect();

    // Delta: how far the idle book needs to travel from the carousel book's position
    const dx = sourceRect.left + sourceRect.width / 2 - (targetRect.left + targetRect.width / 2);
    const dy = sourceRect.top + sourceRect.height / 2 - (targetRect.top + targetRect.height / 2);
    const scaleX = sourceRect.width / targetRect.width;
    const scaleY = sourceRect.height / targetRect.height;

    // Animate idle book FROM carousel position TO its natural position
    gsap.from(idleBook, {
      x: dx,
      y: dy,
      scaleX,
      scaleY,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    });

  }, [settleTick]);

  const handleBack = useCallback(() => {
    if (!onTemplateBack) return;

    const backBtn = document.querySelector('.tc-idle-back');
    const book = document.querySelector('.tc-idle-cover .tc-book');
    const tl = gsap.timeline({
      onComplete: () => onTemplateBack(),
    });

    if (backBtn) tl.to(backBtn, { x: -20, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
    if (book) tl.to(book, { scale: 0.92, opacity: 0, filter: 'blur(2px)', duration: 0.35, ease: 'power2.in' }, 0.05);
  }, [onTemplateBack]);

  const showChooser = !hasContent && (onTemplateSelect || transitioning);

  if (!bookSize) {
    return <div className="storybook-wrapper" ref={wrapperRef} />;
  }

  return (
    <div className={`storybook-wrapper${showChooser ? ' storybook-wrapper--chooser' : !hasContent ? ' storybook-wrapper--idle' : ''}`} ref={wrapperRef} style={{ '--page-scale': pageScale }}>
      {showChooser ? (
        <TemplateChooser onSelect={transitioning ? undefined : handleTemplateTransition} language={language} onLanguageChange={onLanguageChange} bookSize={bookSize} initialTemplate={template} />
      ) : !hasContent ? (
        /* Template chosen, waiting for first prompt — show the selected book cover standing alone */
        <div className={`tc-idle-cover${displayPrompt && !hasContent ? ' tc-idle-preparing' : ''}`}>
          {onTemplateBack && (
            <button type="button" className="tc-back-btn tc-idle-back" onClick={handleBack} aria-label="Back to templates">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Templates</span>
            </button>
          )}
          <BookCover templateKey={template} size={bookSize} standalone selected />
        </div>
      ) : (
        <>
        {displayPrompt && (() => {
          const leftPrompt = spreadPrompts?.left || displayPrompt;
          const rightPrompt = spreadPrompts?.right;
          const showTwo = !singlePage && rightPrompt && rightPrompt !== leftPrompt;
          const pillIcon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          );
          const pageW = bookSize?.w || 480;
          const pill = (prompt, key) => (
            <div
              key={key}
              className="book-prompt-pill"
              title={prompt}
              onClick={() => setExpandedPrompt(prompt)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: showTwo ? pageW : pageW * 2,
                maxWidth: showTwo ? pageW : pageW * 2,
                minWidth: 0, overflow: 'hidden',
                padding: '5px 16px', borderRadius: 999,
                background: 'var(--glass-bg-strong)',
                border: '1px solid var(--glass-border)',
                backdropFilter: 'var(--glass-blur)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {pillIcon}
              <p style={{ margin: 0, minWidth: 0, fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prompt}</p>
            </div>
          );
          return (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, width: '100%', flexShrink: 0, marginBottom: 6 }}>
              {pill(leftPrompt, 'left')}
              {showTwo && pill(rightPrompt, 'right')}
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

          <div style={singlePage ? { maxWidth: bookSize.w + 1, margin: '0 auto' } : undefined}>
            <HTMLFlipBook
              key={singlePage ? 'portrait' : 'landscape'}
              ref={bookRef}
              width={bookSize.w}
              height={bookSize.h}
              size="fixed"
              showCover={true}
              startPage={initialPageRef.current}
              drawShadow={true}
              maxShadowOpacity={theme === 'light' ? 0.12 : 0.5}
              flippingTime={500}
              usePortrait={singlePage}
              startZIndex={0}
              autoSize={true}
              mobileScrollSupport={true}
              disableFlipByClick={false}
              clickEventForward={true}
              useMouseEvents={false}
              swipeDistance={30}
              onFlip={onFlip}
              className="storybook"
            >
              {pages}
            </HTMLFlipBook>
          </div>

          <button
            className="book-nav-overlay book-nav-overlay-right"
            onClick={goNext}
            disabled={singlePage ? currentPage >= maxPage : currentPage + 2 > maxPage}
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
        const bookmarkSpread = bookmarkPage ? (singlePage ? bookmarkPage : Math.ceil(bookmarkPage / 2)) : null;
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

      {expandedPrompt && (
        <div className="prompt-expand-overlay" onClick={() => setExpandedPrompt(null)}>
          <div className="prompt-expand-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)' }}>
                  Prompt
                </span>
              </div>
              <button
                onClick={() => setExpandedPrompt(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {expandedPrompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(StoryCanvas);
