import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ── Fixed-position tooltip that escapes overflow:hidden parents ── */
export default function ActionBtn({ label, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const ref = useRef(null);
  const onEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setPos({ top: r.top - 28, left: r.left + r.width / 2 });
      }
      setShow(true);
    }, 400);
  }, []);
  const onLeave = useCallback(() => { clearTimeout(timer.current); setShow(false); }, []);
  return (
    <span ref={ref} style={{ display: 'inline-flex' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {show && pos && createPortal(
        <span style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.03em',
          padding: '3px 8px',
          borderRadius: '6px',
          background: 'rgba(20,15,30,0.92)',
          color: '#ccc',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease',
          zIndex: 9999,
        }}>
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
