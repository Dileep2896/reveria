import { useState, useEffect } from 'react';

const SPREAD_ASPECT = 3 / 4;   // width:height per page in spread mode
const SINGLE_ASPECT = 9 / 10;  // single-page is wider but same height as spread
const RESERVED_V = 80;         // vertical space for prompt pill + nav dots + padding

export default function useBookSize(wrapperRef, singlePage = false) {
  const [bookSize, setBookSize] = useState(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (cw < 1 || ch < 1) return; // skip degenerate initial measure
      const availH = Math.max(240, ch - RESERVED_V);
      const availW = cw - 32;

      // Compute page width from available height, capped by half the width
      const spreadW = Math.min(Math.round(availH * SPREAD_ASPECT), Math.floor(availW / 2));
      // Derive height from width, but NEVER exceed available height
      const h = Math.min(Math.round(spreadW / SPREAD_ASPECT), availH);

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
