import { useSceneActions } from '../../contexts/SceneActionsContext';
import IconBtn from '../IconBtn';

export default function SceneImageArea({ scene, scale, displayIndex, imageLoaded, imageFailed, isBusy, showError, preloaded, skip, wasRegenerated }) {
  const { regenImage, isReadOnly } = useSceneActions();
  const isError = scene.image_url === 'error';

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
      className="scene-image-wrap rounded-lg overflow-hidden"
      style={{
        flex: '0 0 35%',
        flexShrink: 0,
        marginBottom: `${6 * scale}px`,
        background: 'var(--book-page-bg)',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <>
        {/* Shimmer placeholder while image loads / generates */}
        {!imageLoaded && (
          <div
            className="absolute inset-0"
            style={{
              background: 'var(--glass-bg)',
              zIndex: 1,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 50%, var(--accent-primary-soft) 0%, transparent 60%),
                  radial-gradient(ellipse at 70% 50%, var(--accent-secondary-soft) 0%, transparent 60%)
                `,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div
                className="rounded-lg flex items-center justify-center"
                style={{
                  width: `${32 * scale}px`,
                  height: `${32 * scale}px`,
                  background: 'var(--glass-bg-strong)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'var(--glass-blur)',
                  boxShadow: 'var(--shadow-glow-primary)',
                  animation: 'pulse 2.5s ease-in-out infinite',
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
                className="font-medium tracking-wide"
                style={{ fontSize: `${9 * scale}px`, color: 'var(--text-secondary)' }}
              >
                Painting scene
              </span>
            </div>
          </div>
        )}
        {scene.image_url && scene.image_url !== 'error' && (
        <img
          src={scene.image_url}
          alt={`Scene ${displayIndex ?? scene.scene_number}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: 'scale(1.04)',
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

      {/* Busy overlay — shimmer + icon */}
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

      {/* Regen Image button — stays on image (only affects image) */}
      {!isReadOnly && !isBusy && (
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
