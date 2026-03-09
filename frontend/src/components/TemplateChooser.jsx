import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { TEMPLATES } from '../data/templates';
import { CARD_DESIGNS } from '../data/templateCardDesigns';
import { LANGUAGES } from '../data/languages';
import './templateChooser.css';

/* Template icons — scalable via CSS */
const _icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="tc-icon-svg">{d}</svg>
);
const ICONS = {
  book: _icon(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  zap: _icon(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  smartphone: _icon(<><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>),
  shield: _icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  layers: _icon(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  'file-text': _icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  'edit-3': _icon(<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>),
  feather: _icon(<><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></>),
  camera: _icon(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>),
};

/* Ornament SVGs */
function OrnateOrnament({ color }) {
  return (
    <svg className="tc-ornament-svg" viewBox="0 0 60 10" fill="none">
      <path d="M0 5 C10 0, 20 10, 30 5 C40 0, 50 10, 60 5" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="30" cy="5" r="1.5" fill={color} opacity="0.4" />
      <circle cx="10" cy="5" r="1" fill={color} opacity="0.25" />
      <circle cx="50" cy="5" r="1" fill={color} opacity="0.25" />
    </svg>
  );
}

function DoubleLineOrnament({ color }) {
  return (
    <svg className="tc-ornament-svg" viewBox="0 0 50 8" fill="none">
      <line x1="0" y1="2" x2="50" y2="2" stroke={color} strokeWidth="0.7" opacity="0.4" />
      <line x1="0" y1="6" x2="50" y2="6" stroke={color} strokeWidth="0.7" opacity="0.4" />
      <rect x="20" y="1" width="10" height="6" rx="1" fill="none" stroke={color} strokeWidth="0.6" opacity="0.3" />
    </svg>
  );
}

function MinimalOrnament({ color }) {
  return (
    <svg className="tc-ornament-svg" viewBox="0 0 40 6" fill="none">
      <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <circle cx="20" cy="3" r="1.5" fill={color} opacity="0.3" />
      <line x1="24" y1="3" x2="40" y2="3" stroke={color} strokeWidth="0.7" opacity="0.35" />
    </svg>
  );
}

const ORNAMENT = { ornate: OrnateOrnament, double: DoubleLineOrnament, minimal: MinimalOrnament };

/* ---- Thematic scene illustrations (behind cover content) ---- */
function SceneIllustration({ sceneKey, color }) {
  const o = 0.12; // base opacity
  switch (sceneKey) {
    case 'storybook':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Castle silhouette */}
          <rect x="70" y="160" width="20" height="60" fill={color} opacity={o * 1.2} />
          <rect x="100" y="170" width="20" height="50" fill={color} opacity={o} />
          <rect x="60" y="155" width="40" height="8" fill={color} opacity={o * 1.2} rx="1" />
          <rect x="90" y="165" width="40" height="8" fill={color} opacity={o} rx="1" />
          <polygon points="65,155 80,135 95,155" fill={color} opacity={o * 1.5} />
          <polygon points="95,165 110,142 125,165" fill={color} opacity={o * 1.3} />
          {/* Stars */}
          <circle cx="40" cy="80" r="2" fill={color} opacity={o * 2} />
          <circle cx="155" cy="60" r="1.5" fill={color} opacity={o * 2} />
          <circle cx="130" cy="100" r="1.8" fill={color} opacity={o * 1.5} />
          <circle cx="60" cy="50" r="1.2" fill={color} opacity={o * 1.8} />
          <circle cx="170" cy="120" r="1" fill={color} opacity={o * 1.5} />
          {/* Moon */}
          <circle cx="160" cy="40" r="12" fill={color} opacity={o * 0.8} />
          <circle cx="165" cy="36" r="10" fill="currentColor" opacity={0.15} className="tc-scene-cutout" />
        </svg>
      );
    case 'comic':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Action burst */}
          <polygon points="150,40 160,70 190,60 170,85 200,95 168,100 175,130 150,110 130,135 135,105 105,100 130,85 120,60 145,70" fill={color} opacity={o * 1.5} />
          {/* Halftone dots pattern */}
          {[...Array(8)].map((_, i) => (
            <circle key={`h${i}`} cx={20 + i * 22} cy={250 + (i % 2) * 12} r={3 + (i % 3)} fill={color} opacity={o * 0.8} />
          ))}
          {/* Speech bubble */}
          <ellipse cx="50" cy="80" rx="30" ry="20" fill={color} opacity={o * 0.8} />
          <polygon points="55,98 45,115 65,95" fill={color} opacity={o * 0.8} />
          {/* Action lines */}
          <line x1="5" y1="180" x2="60" y2="170" stroke={color} strokeWidth="1.5" opacity={o} />
          <line x1="5" y1="195" x2="55" y2="188" stroke={color} strokeWidth="1" opacity={o * 0.8} />
          <line x1="5" y1="210" x2="50" y2="205" stroke={color} strokeWidth="1.5" opacity={o} />
        </svg>
      );
    case 'webtoon':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Phone frame */}
          <rect x="60" y="50" width="80" height="140" rx="10" stroke={color} strokeWidth="1.5" opacity={o * 1.5} />
          <rect x="65" y="60" width="70" height="115" rx="2" stroke={color} strokeWidth="0.8" opacity={o} />
          <circle cx="100" cy="185" r="3" stroke={color} strokeWidth="1" opacity={o} />
          {/* Scroll indicators */}
          <rect x="145" y="70" width="3" height="20" rx="1.5" fill={color} opacity={o * 1.5} />
          <rect x="145" y="95" width="3" height="40" rx="1.5" fill={color} opacity={o * 0.8} />
          {/* Panels inside */}
          <rect x="70" y="65" width="60" height="25" rx="1" fill={color} opacity={o * 0.6} />
          <rect x="70" y="95" width="60" height="35" rx="1" fill={color} opacity={o * 0.4} />
          <rect x="70" y="135" width="60" height="30" rx="1" fill={color} opacity={o * 0.5} />
        </svg>
      );
    case 'hero':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Sword */}
          <line x1="100" y1="60" x2="100" y2="200" stroke={color} strokeWidth="2" opacity={o * 1.5} />
          <rect x="96" y="195" width="8" height="20" rx="1" fill={color} opacity={o * 1.2} />
          <rect x="82" y="192" width="36" height="6" rx="2" fill={color} opacity={o * 1.5} />
          <polygon points="94,60 100,30 106,60" fill={color} opacity={o * 1.8} />
          {/* Shield */}
          <path d="M40 120 Q40 100 60 100 Q80 100 80 120 Q80 155 60 170 Q40 155 40 120Z" stroke={color} strokeWidth="1.5" opacity={o * 1.2} fill={color} fillOpacity={o * 0.3} />
          {/* Rays */}
          {[...Array(6)].map((_, i) => {
            const angle = (i * 60 - 90) * (Math.PI / 180);
            return <line key={`r${i}`} x1={160} y1={80} x2={160 + Math.cos(angle) * 25} y2={80 + Math.sin(angle) * 25} stroke={color} strokeWidth="1" opacity={o} />;
          })}
          <circle cx="160" cy="80" r="8" fill={color} opacity={o} />
        </svg>
      );
    case 'manga':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Speed lines */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30) * (Math.PI / 180);
            return <line key={`s${i}`} x1={100 + Math.cos(angle) * 30} y1={120 + Math.sin(angle) * 30} x2={100 + Math.cos(angle) * 90} y2={120 + Math.sin(angle) * 90} stroke={color} strokeWidth="0.8" opacity={o * (0.5 + (i % 3) * 0.3)} />;
          })}
          {/* Dramatic eye */}
          <ellipse cx="100" cy="120" rx="22" ry="14" stroke={color} strokeWidth="1.2" opacity={o * 1.5} />
          <circle cx="100" cy="120" r="7" fill={color} opacity={o * 1.2} />
          <circle cx="103" cy="117" r="2.5" fill="currentColor" opacity={0.08} />
          {/* Panels */}
          <line x1="20" y1="230" x2="180" y2="230" stroke={color} strokeWidth="0.8" opacity={o} />
          <line x1="20" y1="260" x2="180" y2="260" stroke={color} strokeWidth="0.8" opacity={o} />
          <line x1="90" y1="230" x2="110" y2="260" stroke={color} strokeWidth="0.8" opacity={o} />
        </svg>
      );
    case 'novel':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Quill */}
          <path d="M140 50 Q160 80 145 120 Q140 135 135 140 L130 130 Q150 90 135 60Z" fill={color} opacity={o * 1.2} />
          <line x1="135" y1="140" x2="100" y2="240" stroke={color} strokeWidth="1.2" opacity={o} />
          {/* Ink splash */}
          <circle cx="98" cy="242" r="5" fill={color} opacity={o * 1.5} />
          <circle cx="93" cy="248" r="2.5" fill={color} opacity={o} />
          <circle cx="105" cy="247" r="2" fill={color} opacity={o * 0.8} />
          {/* Text lines */}
          <line x1="35" y1="90" x2="85" y2="90" stroke={color} strokeWidth="1" opacity={o * 0.7} />
          <line x1="35" y1="100" x2="75" y2="100" stroke={color} strokeWidth="1" opacity={o * 0.5} />
          <line x1="35" y1="110" x2="80" y2="110" stroke={color} strokeWidth="1" opacity={o * 0.7} />
          <line x1="35" y1="120" x2="60" y2="120" stroke={color} strokeWidth="1" opacity={o * 0.5} />
        </svg>
      );
    case 'diary':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Pen */}
          <line x1="150" y1="40" x2="120" y2="130" stroke={color} strokeWidth="2" opacity={o * 1.2} />
          <polygon points="120,130 117,140 123,138" fill={color} opacity={o * 1.5} />
          <rect x="145" y="35" width="10" height="15" rx="2" fill={color} opacity={o} transform="rotate(-20,150,42)" />
          {/* Coffee ring stain */}
          <circle cx="55" cy="230" r="22" stroke={color} strokeWidth="2" opacity={o * 0.8} fill="none" />
          <circle cx="55" cy="230" r="20" stroke={color} strokeWidth="0.5" opacity={o * 0.4} fill="none" />
          {/* Handwriting lines (wavy) */}
          <path d="M35 100 Q50 95 65 100 Q80 105 95 100" stroke={color} strokeWidth="0.8" opacity={o * 0.8} />
          <path d="M35 115 Q55 110 75 115 Q90 120 105 115" stroke={color} strokeWidth="0.8" opacity={o * 0.6} />
          <path d="M35 130 Q48 125 60 130" stroke={color} strokeWidth="0.8" opacity={o * 0.7} />
          {/* Heart doodle */}
          <path d="M160 200 Q160 190 170 190 Q180 190 180 200 Q180 210 170 218 Q160 210 160 200Z" fill={color} opacity={o * 0.8} />
        </svg>
      );
    case 'poetry':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Feather */}
          <path d="M155 30 Q140 70 120 110 Q110 130 105 140" stroke={color} strokeWidth="1" opacity={o * 1.2} />
          <path d="M155 30 Q170 60 145 100 Q130 125 120 110 Q140 80 155 30Z" fill={color} opacity={o * 0.8} />
          <path d="M155 30 Q135 55 120 90 Q115 100 105 110 Q120 85 145 50Z" fill={color} opacity={o * 0.6} />
          {/* Flowing curves */}
          <path d="M20 200 Q60 180 100 200 Q140 220 180 200" stroke={color} strokeWidth="1" opacity={o * 0.6} fill="none" />
          <path d="M30 230 Q70 210 110 230 Q150 250 190 230" stroke={color} strokeWidth="0.8" opacity={o * 0.4} fill="none" />
          {/* Stanza lines */}
          <line x1="40" y1="80" x2="80" y2="80" stroke={color} strokeWidth="0.8" opacity={o * 0.6} />
          <line x1="50" y1="92" x2="95" y2="92" stroke={color} strokeWidth="0.8" opacity={o * 0.5} />
          <line x1="45" y1="104" x2="70" y2="104" stroke={color} strokeWidth="0.8" opacity={o * 0.6} />
          <line x1="55" y1="125" x2="90" y2="125" stroke={color} strokeWidth="0.8" opacity={o * 0.5} />
          <line x1="40" y1="137" x2="85" y2="137" stroke={color} strokeWidth="0.8" opacity={o * 0.6} />
        </svg>
      );
    case 'photojournal':
      return (
        <svg viewBox="0 0 200 300" className="tc-scene-svg" fill="none">
          {/* Camera viewfinder */}
          <rect x="55" y="60" width="90" height="70" rx="4" stroke={color} strokeWidth="1.5" opacity={o * 1.2} />
          <circle cx="100" cy="95" r="18" stroke={color} strokeWidth="1.2" opacity={o * 1.5} />
          <circle cx="100" cy="95" r="10" stroke={color} strokeWidth="0.8" opacity={o} />
          {/* Crosshair */}
          <line x1="100" y1="72" x2="100" y2="82" stroke={color} strokeWidth="0.8" opacity={o} />
          <line x1="100" y1="108" x2="100" y2="118" stroke={color} strokeWidth="0.8" opacity={o} />
          <line x1="70" y1="95" x2="80" y2="95" stroke={color} strokeWidth="0.8" opacity={o} />
          <line x1="120" y1="95" x2="130" y2="95" stroke={color} strokeWidth="0.8" opacity={o} />
          {/* Film strip */}
          <rect x="25" y="190" width="150" height="28" rx="2" stroke={color} strokeWidth="1" opacity={o} />
          {[...Array(6)].map((_, i) => (
            <rect key={`f${i}`} x={32 + i * 24} y="195" width="16" height="18" rx="1" fill={color} opacity={o * (0.4 + (i % 3) * 0.2)} />
          ))}
          {/* Sprocket holes */}
          {[...Array(7)].map((_, i) => (
            <rect key={`sp${i}`} x={28 + i * 22} y="188" width="4" height="4" rx="0.5" fill={color} opacity={o * 0.6} />
          ))}
        </svg>
      );
    default:
      return null;
  }
}

function LanguagePicker({ language, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [open]);

  return (
    <div className="tc-lang-picker" ref={ref}>
      <button type="button" className="tc-lang-trigger" onClick={() => setOpen(!open)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{LANGUAGES.find(l => l.key === language)?.label || 'English'}</span>
        <svg width="9" height="5" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="tc-lang-menu">
          {LANGUAGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`tc-lang-option${language === key ? ' active' : ''}`}
              onClick={() => { onChange(key); setOpen(false); }}
            >
              {language === key && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a single book cover for a template.
 * Sizes are driven by the `size` prop (from useBookSize).
 * `standalone` = full page-size idle cover.
 * Otherwise uses the scale factor for carousel/grid display.
 */
function BookCover({ templateKey, size, selected, onClick, standalone, scale = 0.55, style, flipId }) {
  const t = TEMPLATES.find(x => x.key === templateKey) || TEMPLATES[0];
  const design = CARD_DESIGNS[t.key] || CARD_DESIGNS.storybook;
  const Ornament = ORNAMENT[design.frameStyle] || MinimalOrnament;

  const coverH = standalone ? size.h : Math.round(size.h * scale);
  const coverW = standalone ? size.w : Math.round(coverH * 0.7);
  const spineW = standalone ? Math.max(14, Math.round(coverW * 0.06)) : Math.max(10, Math.round(coverW * 0.08));
  const iconSize = Math.round(coverH * (standalone ? 0.14 : 0.16));
  const titleSize = Math.round(coverH * (standalone ? 0.045 : 0.05));
  const descSize = Math.round(coverH * (standalone ? 0.028 : 0.032));
  const taglineSize = Math.round(coverH * (standalone ? 0.024 : 0.028));

  return (
    <button
      data-flip-id={flipId || undefined}
      className={`tc-book${selected ? ' selected' : ''}${standalone ? ' standalone' : ''}`}
      style={{
        '--book-accent': design.accent,
        '--book-gradient': design.gradient,
        '--book-spine': design.spine,
        '--book-icon-bg': design.iconBg,
        '--book-pattern': design.pattern || 'none',
        '--book-pattern-size': design.patternSize || '100% 100%',
        ...style,
      }}
      onClick={onClick}
    >
      <div className="tc-book-spine" style={{ width: spineW }}>
        <span className="tc-book-spine-title">{t.label}</span>
      </div>
      <div className="tc-book-cover" style={{ width: coverW, height: coverH }}>
        <div className="tc-book-pattern" />
        {design.sceneSvg && (
          <div className="tc-book-scene">
            <SceneIllustration sceneKey={design.sceneSvg} color={design.accent} />
          </div>
        )}
        <div className={`tc-book-frame tc-book-frame--${design.frameStyle || 'minimal'}`}>
          <div className="tc-book-ornament">
            <Ornament color={design.accent} />
          </div>
          <div className="tc-book-emblem" style={{ width: iconSize, height: iconSize }}>
            {ICONS[t.icon] || ICONS.book}
          </div>
          <h3 className="tc-book-title" style={{ fontSize: titleSize }}>{t.label}</h3>
          {design.tagline && (
            <p className="tc-book-tagline" style={{ fontSize: taglineSize }}>{design.tagline}</p>
          )}
          <p className="tc-book-desc" style={{ fontSize: descSize }}>{t.description}</p>
          <div className="tc-book-ornament">
            <Ornament color={design.accent} />
          </div>
        </div>
        <div className="tc-book-pages" />
      </div>
    </button>
  );
}

export { BookCover };

/* ---- 3D Coverflow Carousel ---- */
function CoverflowCarousel({ items, focusIndex, onFocusChange, onSelect, size }) {
  const containerRef = useRef(null);
  const [containerH, setContainerH] = useState(0);

  // Measure the actual coverflow container height so books fill available space
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Touch / drag tracking
  const dragRef = useRef({ startX: 0, dragging: false });

  const handlePointerDown = useCallback((e) => {
    dragRef.current = { startX: e.clientX, dragging: true };
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.dragging = false;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && focusIndex < items.length - 1) onFocusChange(focusIndex + 1);
      else if (dx > 0 && focusIndex > 0) onFocusChange(focusIndex - 1);
    }
  }, [focusIndex, items.length, onFocusChange]);

  // Wheel navigation
  const wheelTimer = useRef(null);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (wheelTimer.current) return;
    wheelTimer.current = setTimeout(() => { wheelTimer.current = null; }, 300);
    if (e.deltaX > 20 || e.deltaY > 20) {
      if (focusIndex < items.length - 1) onFocusChange(focusIndex + 1);
    } else if (e.deltaX < -20 || e.deltaY < -20) {
      if (focusIndex > 0) onFocusChange(focusIndex - 1);
    }
  }, [focusIndex, items.length, onFocusChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Size books to fill ~75% of the measured container, capped at 520px
  const effectiveH = containerH || size.h * 0.65;
  const coverH = Math.min(Math.round(effectiveH * 0.75), 520);
  const coverW = Math.round(coverH * 0.7);
  const spineW = Math.max(10, Math.round(coverW * 0.08));
  const fullBookW = coverW + spineW;
  const sideSpacing = Math.round(fullBookW * 0.58);
  // Pass the derived scale to BookCover (coverH relative to size.h)
  const derivedScale = coverH / size.h;

  return (
    <div
      className="tc-coverflow"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Track has the focused book's dimensions so it takes layout space and centers */}
      <div className="tc-coverflow-track" style={{ width: fullBookW, height: coverH }}>
        {items.map((t, i) => {
          const offset = i - focusIndex;
          const absOffset = Math.abs(offset);
          const isFocused = offset === 0;

          // X: side items pushed out from center
          const tx = isFocused ? 0 : offset * sideSpacing;
          // Z depth: focused comes forward, sides recede
          const tz = isFocused ? 50 : -(60 + absOffset * 60);
          // Rotation toward center
          const ry = isFocused ? 0 : offset < 0 ? 38 : -38;
          // Scale: center 1, sides shrink
          const sc = isFocused ? 1 : Math.max(0.5, 0.78 - (absOffset - 1) * 0.1);
          // Opacity
          const op = isFocused ? 1 : Math.max(0, 0.7 - (absOffset - 1) * 0.2);
          // Z-index
          const zi = 100 - absOffset;

          if (absOffset > 3) return null;

          return (
            <div
              key={t.key}
              className={`tc-coverflow-item${isFocused ? ' focused' : ''}`}
              style={{
                transform: `translate(-50%, -50%) translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`,
                opacity: op,
                zIndex: zi,
              }}
              onClick={() => {
                if (isFocused) onSelect(t.key);
                else onFocusChange(i);
              }}
            >
              <BookCover
                templateKey={t.key}
                size={size}
                selected={isFocused}
                scale={derivedScale}
                flipId={isFocused ? 'hero-book' : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Arrow nav */}
      <button
        className="tc-coverflow-arrow tc-coverflow-arrow--left"
        onClick={() => focusIndex > 0 && onFocusChange(focusIndex - 1)}
        disabled={focusIndex === 0}
        aria-label="Previous template"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className="tc-coverflow-arrow tc-coverflow-arrow--right"
        onClick={() => focusIndex < items.length - 1 && onFocusChange(focusIndex + 1)}
        disabled={focusIndex === items.length - 1}
        aria-label="Next template"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}


export default function TemplateChooser({ onSelect, language, onLanguageChange, bookSize, initialTemplate }) {
  const available = useMemo(() => TEMPLATES.filter(t => t.available), []);
  const [focusIndex, setFocusIndex] = useState(() => {
    if (!initialTemplate) return 0;
    const idx = available.findIndex(t => t.key === initialTemplate);
    return idx >= 0 ? idx : 0;
  });
  const [viewMode, setViewMode] = useState('carousel');

  const size = bookSize || { w: 360, h: 480 };

  const focusedTemplate = available[focusIndex];
  const focusedDesign = focusedTemplate ? CARD_DESIGNS[focusedTemplate.key] : null;

  /* Keyboard navigation */
  const handleKeyDown = useCallback((e) => {
    if (viewMode !== 'carousel') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex(i => Math.min(i + 1, available.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedTemplate) {
      e.preventDefault();
      onSelect(focusedTemplate.key);
    }
  }, [viewMode, available.length, focusedTemplate, onSelect]);

  // Grid mode: separate selected state
  const [gridSelected, setGridSelected] = useState(null);
  const gridSelectedTemplate = gridSelected ? TEMPLATES.find(t => t.key === gridSelected) : null;
  const gridSelectedDesign = gridSelected ? CARD_DESIGNS[gridSelected] : null;

  return (
    <div className="template-chooser" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="tc-header">
        <h2 className="tc-title">Choose Your Canvas</h2>
        <button
          type="button"
          className="tc-view-toggle"
          onClick={() => setViewMode(v => v === 'carousel' ? 'grid' : 'carousel')}
        >
          {viewMode === 'carousel' ? 'View All' : 'Carousel'}
        </button>
      </div>

      {viewMode === 'carousel' ? (
        <>
          <CoverflowCarousel
            items={available}
            focusIndex={focusIndex}
            onFocusChange={setFocusIndex}
            onSelect={(key) => onSelect(key)}
            size={size}
          />
          <div className="tc-footer">
            <button
              type="button"
              className="tc-confirm"
              style={{ '--confirm-accent': focusedDesign?.accent || 'var(--accent-primary)' }}
              onClick={() => onSelect(focusedTemplate.key)}
            >
              Choose {focusedTemplate?.label || 'Template'}
            </button>
            {onLanguageChange && (
              <LanguagePicker language={language} onChange={onLanguageChange} />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="tc-grid">
            {available.map((t) => (
              <BookCover
                key={t.key}
                templateKey={t.key}
                size={size}
                selected={t.key === gridSelected}
                onClick={() => setGridSelected(prev => prev === t.key ? null : t.key)}
                scale={0.44}
                flipId={t.key === gridSelected ? 'hero-book' : undefined}
              />
            ))}
          </div>
          <div className="tc-footer">
            {gridSelected && (
              <button
                type="button"
                className="tc-confirm"
                style={{ '--confirm-accent': gridSelectedDesign?.accent || 'var(--accent-primary)' }}
                onClick={() => onSelect(gridSelected)}
              >
                Choose {gridSelectedTemplate?.label || 'Template'}
              </button>
            )}
            {onLanguageChange && (
              <LanguagePicker language={language} onChange={onLanguageChange} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
