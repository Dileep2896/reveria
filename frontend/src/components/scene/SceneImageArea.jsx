import { useState } from 'react';
import { useSceneActions } from '../../contexts/SceneActionsContext';
import IconBtn from '../IconBtn';

export default function SceneImageArea({ scene, scale, displayIndex, imageLoaded, isBusy, showError, preloaded, skip, wasRegenerated, singlePage, visualNarrative }) {
  const { regenImage, isReadOnly, canRegen } = useSceneActions();
  const [showBrief, setShowBrief] = useState(false);

  // ── Visual narrative with per-panel images ──
  if (visualNarrative && scene.panel_images?.length > 0) {
    return (
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: `${2 * scale}px`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {scene.panel_images.map((panel, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 0',
              minHeight: 0,
              position: 'relative',
              borderRadius: `${4 * scale}px`,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'var(--book-page-bg)',
            }}
          >
            {panel?.url ? (
              <img
                src={panel.url}
                alt={`Scene ${displayIndex ?? scene.scene_number} panel ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  animation: skip ? 'none' : 'imageFadeIn 0.8s ease-out',
                }}
              />
            ) : (
              /* Shimmer placeholder per panel */
              <div
                className="painting-loader"
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'var(--glass-bg)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 65%, transparent 100%)',
                  animation: 'shimmer 2.5s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: `${8 * scale}px`, color: 'var(--text-muted)', opacity: 0.5 }}>
                    Panel {i + 1}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Regen Image button for panel layout */}
        {!isReadOnly && !isBusy && canRegen && (
          <div
            className="scene-action-bar"
            style={{
              position: 'absolute',
              top: `${4 * scale}px`,
              right: `${4 * scale}px`,
              zIndex: 10,
              display: 'flex',
            }}
          >
            <IconBtn
              label="Regenerate panels"
              size={22 * scale}
              dark
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => { e.stopPropagation(); regenImage?.(scene.scene_number, scene.text); }}
            >
              <svg width={11 * scale} height={11 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </IconBtn>
          </div>
        )}

        {/* Busy overlay for panel regeneration */}
        {isBusy && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(2px)',
              borderRadius: 'inherit',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                animation: 'shimmer 2s ease-in-out infinite',
              }} />
            </div>
            <span style={{
              fontSize: `${9 * scale}px`, fontWeight: 500,
              color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em',
              textTransform: 'uppercase', position: 'relative',
            }}>
              Regenerating...
            </span>
          </div>
        )}
      </div>
    );
  }

  // Collapsed error / no-image indicator
  if (showError || (preloaded && !scene.image_url)) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md"
        style={{
          flexShrink: 0,
          marginBottom: `${6 * scale}px`,
          padding: `${4 * scale}px ${8 * scale}px`,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <svg
          width={12 * scale} height={12 * scale} viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.5 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span style={{ fontSize: `${8 * scale}px`, color: 'var(--text-muted)', opacity: 0.6 }}>
          {scene.image_error_reason === 'quota_exhausted'
            ? 'Image quota reached'
            : scene.image_error_reason === 'safety_filter'
            ? 'Image blocked by safety filter'
            : scene.image_error_reason === 'timeout'
            ? 'Image timed out'
            : 'Illustration unavailable'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="scene-image-wrap overflow-hidden"
      style={{
        flex: visualNarrative ? '1 1 0' : singlePage ? '0 0 48%' : '0 0 35%',
        flexShrink: 0,
        marginBottom: `${6 * scale}px`,
        background: 'var(--book-page-bg)',
        position: 'relative',
        borderRadius: `${4 * scale}px`,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(0,0,0,0.15)',
      }}
    >
      <>
        {/* Shimmer placeholder while image loads / generates */}
        {!imageLoaded && (
          <div
            className="absolute inset-0 painting-loader"
            style={{
              background: 'var(--glass-bg)',
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Animated gradient blobs */}
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse at 30% 40%, var(--accent-primary-soft) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 60%, var(--accent-secondary-soft) 0%, transparent 50%)
              `,
              animation: 'paintBlobDrift 6s ease-in-out infinite alternate',
            }} />
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse at 60% 30%, var(--accent-secondary-soft) 0%, transparent 45%),
                radial-gradient(ellipse at 40% 70%, var(--accent-primary-soft) 0%, transparent 45%)
              `,
              animation: 'paintBlobDrift 6s ease-in-out 3s infinite alternate-reverse',
              opacity: 0.6,
            }} />

            {/* Shimmer sweep */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 65%, transparent 100%)',
              animation: 'shimmer 2.5s ease-in-out infinite',
            }} />

            {/* Floating sparkles */}
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="absolute" style={{
                width: `${(2 + i % 2) * scale}px`,
                height: `${(2 + i % 2) * scale}px`,
                borderRadius: '50%',
                background: i % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                left: `${15 + i * 17}%`,
                top: `${20 + (i * 13) % 60}%`,
                opacity: 0,
                animation: `paintSparkle 3s ease-in-out ${i * 0.6}s infinite`,
              }} />
            ))}

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              {/* Orbiting rings */}
              <div style={{ position: 'relative', width: `${56 * scale}px`, height: `${56 * scale}px`, marginBottom: `${8 * scale}px` }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `1px solid var(--accent-primary)`, opacity: 0.2,
                  animation: 'paintRingSpin 8s linear infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: `${4 * scale}px`, borderRadius: '50%',
                  border: `1px dashed var(--accent-secondary)`, opacity: 0.15,
                  animation: 'paintRingSpin 6s linear infinite reverse',
                }} />
                {/* Orbiting dot */}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: `${4 * scale}px`, height: `${4 * scale}px`, borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  boxShadow: '0 0 8px var(--accent-primary-glow)',
                  animation: 'paintOrbitDot 4s linear infinite',
                  transformOrigin: `${0}px ${28 * scale}px`,
                }} />
                {/* Center icon */}
                <div style={{
                  position: 'absolute', inset: `${10 * scale}px`,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--glass-bg-strong)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'var(--glass-blur)',
                  boxShadow: 'var(--shadow-glow-primary)',
                  animation: 'paintIconPulse 3s ease-in-out infinite',
                }}>
                  <svg
                    width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none"
                    stroke="var(--accent-primary)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: 'paintBrushWiggle 2s ease-in-out infinite' }}
                  >
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                </div>
              </div>

              <span className="font-medium tracking-wide" style={{
                fontSize: `${9 * scale}px`, color: 'var(--text-secondary)',
                animation: 'paintTextPulse 2s ease-in-out infinite',
              }}>
                Painting scene
              </span>

              {/* Animated dots */}
              <div style={{ display: 'flex', gap: `${3 * scale}px`, marginTop: `${4 * scale}px` }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: `${3 * scale}px`, height: `${3 * scale}px`, borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    animation: `paintDotBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {scene.image_url && scene.image_url !== 'error' && (
        <img
          src={scene.image_url}
          alt={`Scene ${displayIndex ?? scene.scene_number}`}
          style={{
            width: '100%',
            height: visualNarrative ? '100%' : 'auto',
            objectFit: 'contain',
            display: 'block',
            opacity: imageLoaded ? 1 : 0,
            animation: skip && !wasRegenerated.current
              ? 'none'
              : imageLoaded
                ? wasRegenerated.current
                  ? 'imageRegenReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'imageFadeIn 0.8s ease-out'
                : 'none',
            position: 'relative',
            zIndex: 2,
          }}
          onAnimationEnd={() => { wasRegenerated.current = false; }}
        />
        )}
      </>

      {/* Creative Brief overlay */}
      {scene.image_brief && imageLoaded && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setShowBrief(v => !v); }}
            className="creative-brief-toggle"
            style={{
              position: 'absolute', top: 4*scale, left: 4*scale, zIndex: 12,
              width: 22*scale, height: 22*scale, borderRadius: '50%',
              background: showBrief ? 'var(--accent-secondary-soft)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${showBrief ? 'var(--glass-border-secondary)' : 'rgba(255,255,255,0.15)'}`,
              color: showBrief ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', padding: 0,
            }}
          >
            <svg width={11*scale} height={11*scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          {showBrief && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 11,
              maxHeight: '50%', overflow: 'auto',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid var(--glass-border-secondary)',
              padding: `${8*scale}px ${10*scale}px`,
              animation: 'briefSlideUp 0.3s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4*scale, marginBottom: 4*scale }}>
                <svg width={9*scale} height={9*scale} viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                </svg>
                <span style={{ fontSize: 8*scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-secondary)' }}>
                  Creative Brief
                </span>
                {scene.image_tier && (
                  <span style={{ fontSize: 7*scale, fontWeight: 600, padding: '1px 5px', borderRadius: 999, background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)', border: '1px solid var(--glass-border-accent)', marginLeft: 'auto' }}>
                    Tier {scene.image_tier}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 9*scale, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                {scene.image_brief}
              </p>
            </div>
          )}
        </>
      )}

      {/* Busy overlay - shimmer + icon */}
      {isBusy && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            borderRadius: 'inherit',
          }}
        >
          {/* Shimmer sweep */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          </div>
          {/* Icon + label */}
          <div
            style={{
              width: `${32 * scale}px`,
              height: `${32 * scale}px`,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 0 20px var(--accent-primary-glow)',
              animation: 'pulse 2s ease-in-out infinite',
              marginBottom: `${6 * scale}px`,
            }}
          >
            <svg
              width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <span
            style={{
              fontSize: `${9 * scale}px`,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              position: 'relative',
            }}
          >
            Regenerating...
          </span>
        </div>
      )}

      {/* Regen Image button - stays on image (only affects image) */}
      {!isReadOnly && !isBusy && canRegen && (
        <div
          className="scene-action-bar"
          style={{
            position: 'absolute',
            top: `${4 * scale}px`,
            right: `${4 * scale}px`,
            zIndex: 10,
            display: 'flex',
          }}
        >
          <IconBtn
            label="Regenerate image"
            size={22 * scale}
            dark
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); regenImage?.(scene.scene_number, scene.text); }}
          >
            <svg width={11 * scale} height={11 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </IconBtn>
        </div>
      )}
    </div>
  );
}
