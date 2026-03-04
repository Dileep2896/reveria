import { useCallback, useEffect } from 'react';

/* ── Helper: find the left page of the spread containing pageIndex ── */
// With showCover, cover=0 is solo. Then spreads are [1,2], [3,4], [5,6]...
// Left page of a spread is always odd. flip() to an odd number is safest.
export function spreadLeftPage(pageIndex) {
  if (pageIndex <= 0) return 0;
  return pageIndex % 2 === 0 ? pageIndex - 1 : pageIndex;
}

export default function useStoryNavigation({ bookRef, currentPage, setCurrentPage, maxPage, scenes, storyId, onPageChange, singlePage = false, generating = false }) {
  /* ── Track current page + clamp to content ── */
  const onFlip = useCallback((e) => {
    const page = e.data;
    setCurrentPage(page);
    // If user swiped/dragged past content, bounce back (instant, no animation)
    if (page > maxPage && bookRef.current) {
      const target = singlePage ? maxPage : spreadLeftPage(maxPage);
      setTimeout(() => {
        try { bookRef.current.pageFlip().turnToPage(target); } catch {}
      }, 0);
    }
    // If user navigated back to cover but there are scenes, bounce to first spread
    // Suppress during generation so the cover→content flip isn't fought
    if (page === 0 && scenes.length > 0 && !generating && bookRef.current) {
      setTimeout(() => {
        try { bookRef.current.pageFlip().turnToPage(1); } catch {}
      }, 0);
    }
  }, [maxPage, scenes.length, bookRef, setCurrentPage, singlePage, generating]);

  /* ── Navigation - clamp to content pages ── */
  const goNext = useCallback(() => {
    if (!bookRef.current) return;
    const cur = bookRef.current.pageFlip().getCurrentPageIndex();
    if (singlePage ? cur >= maxPage : cur + 2 > maxPage) return;
    bookRef.current.pageFlip().flipNext();
  }, [maxPage, bookRef, singlePage]);

  const goPrev = useCallback(() => {
    if (!bookRef.current) return;
    const cur = bookRef.current.pageFlip().getCurrentPageIndex();
    if (cur <= 1 && scenes.length > 0) return;
    bookRef.current.pageFlip().flipPrev();
  }, [scenes.length, bookRef]);

  const goTo = useCallback((idx) => {
    if (!bookRef.current) return;
    const pageIndex = singlePage
      ? idx
      : (idx === 0 ? 0 : (idx - 1) * 2 + 1);
    if (pageIndex > maxPage) return;
    if (pageIndex === 0 && scenes.length > 0) return;
    bookRef.current.pageFlip().flip(pageIndex);
  }, [maxPage, scenes.length, bookRef, singlePage]);

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

  /* ── Sync current page to URL ?page=N ── */
  useEffect(() => {
    if (!storyId || currentPage <= 0) return;
    const url = new URL(window.location);
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState(null, '', url);
  }, [currentPage, storyId]);

  /* ── Notify parent of current scene ── */
  useEffect(() => {
    if (!onPageChange) return;
    if (currentPage === 0) {
      onPageChange(null);
    } else {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange]);

  return { onFlip, goNext, goPrev, goTo };
}
