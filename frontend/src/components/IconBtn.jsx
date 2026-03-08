import Tooltip from './Tooltip';

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
  const cls = ['icon-btn'];
  if (danger) cls.push('icon-btn--danger');
  if (dark) cls.push('icon-btn--dark');
  if (active) cls.push('icon-btn--active');
  if (className) cls.push(className);

  return (
    <Tooltip label={label}>
      <button
        className={cls.join(' ')}
        style={{
          width: size,
          height: size,
          ...(activeColor && active ? { color: activeColor, borderColor: activeColor + '4d' } : {}),
        }}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        {children}
      </button>
    </Tooltip>
  );
}
