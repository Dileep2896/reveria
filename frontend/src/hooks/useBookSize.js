import { useState, useEffect } from 'react';

const ASPECT = 3 / 4; // width:height per page

export default function useBookSize(wrapperRef) {
  const [bookSize, setBookSize] = useState(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      const availH = ch - 56;
      const availW = cw - 32;

      const hFromH = Math.max(280, availH);
      const wFromH = Math.round(hFromH * ASPECT);
      const wFromW = Math.floor(availW / 2);

      const w = Math.min(wFromH, wFromW);
      const h = Math.round(w / ASPECT);
      setBookSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapperRef]);

  return bookSize;
}
