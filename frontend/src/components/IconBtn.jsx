import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Unified circular icon button with hover tooltip.
 *
 * Props:
 *   label       – tooltip text
 *   onClick     – click handler
 *   onPointerDown – optional pointer-down handler (for stopPropagation)
 *   size        – diameter in px (default 28)
 *   danger      – red-tinted variant
 *   dark        – dark overlay variant (for buttons over images)
 *   active      – highlighted state
 *   activeColor – custom color when active (e.g. '#ef4444')
 *   className   – extra CSS class
 *   children    – SVG icon
 */
export default function IconBtn({
  label, onClick, onPointerDown, size = 28,
  danger, dark, active, activeColor, className, children,
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const ref = useRef(null);

  const onEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
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

  const cls = ['icon-btn'];
  if (danger) cls.push('icon-btn--danger');
  if (dark) cls.push('icon-btn--dark');
  if (active) cls.push('icon-btn--active');
  if (className) cls.push(className);

  return (
    <>
      <button
        ref={ref}
        className={cls.join(' ')}
        style={{
          width: size,
          height: size,
          ...(activeColor && active ? { color: activeColor, borderColor: activeColor + '4d' } : {}),
        }}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </button>
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
