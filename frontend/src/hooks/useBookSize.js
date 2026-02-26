import { useState, useEffect } from 'react';

const SPREAD_ASPECT = 3 / 4;   // width:height per page in spread mode
const SINGLE_ASPECT = 9 / 10;  // single-page is wider but same height as spread

export default function useBookSize(wrapperRef, singlePage = false) {
  const [bookSize, setBookSize] = useState(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (cw < 1 || ch < 1) return; // skip degenerate initial measure
      const availH = ch - 56;
      const availW = cw - 32;

      // Always compute height from the spread formula so both modes match
      const hFromH = Math.max(280, availH);
      const spreadW = Math.min(Math.round(hFromH * SPREAD_ASPECT), Math.floor(availW / 2));
      const h = Math.round(spreadW / SPREAD_ASPECT);

      // Width varies by mode: single page is wider, spread uses half-screen
      const w = singlePage
        ? Math.min(Math.round(h * SINGLE_ASPECT), Math.floor(availW * 0.82), 680)
        : spreadW;

      setBookSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapperRef, singlePage]);

  return bookSize;
}
