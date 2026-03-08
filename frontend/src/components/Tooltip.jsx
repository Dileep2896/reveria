import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight tooltip wrapper with glass-morphism styling.
 *
 * Usage:
 *   <Tooltip label="Like this story">
 *     <button>♥</button>
 *   </Tooltip>
 *
 * If label is falsy, renders children only (no overhead).
 */
export default function Tooltip({ label, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  const onEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const measure = document.createElement('span');
      measure.style.cssText =
        'position:fixed;visibility:hidden;font-size:10px;font-weight:600;letter-spacing:0.03em;padding:3px 8px;white-space:nowrap;';
      measure.textContent = label;
      document.body.appendChild(measure);
      const tipW = measure.offsetWidth;
      document.body.removeChild(measure);
      setPos({ top: r.top - 32, left: r.left + r.width / 2 - tipW / 2 });
      setShow(true);
    }, 400);
  }, [label]);

  const onLeave = useCallback(() => {
    clearTimeout(timer.current);
    setShow(false);
  }, []);

  if (!label) return children;

  return (
    <>
      <span
        ref={wrapRef}
        style={{ display: 'inline-flex' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </span>
      {show && pos && createPortal(
        <span
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
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
            opacity: 0,
            animation: 'tooltipIn 0.15s ease forwards',
            zIndex: 9999,
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}
