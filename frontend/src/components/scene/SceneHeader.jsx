import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSceneActions } from '../../contexts/SceneActionsContext';
import IconBtn from '../IconBtn';

export default function SceneHeader({ scene, scale, displayIndex, isBookmarked, isBusy, audio, onRegenSceneStart }) {
  const { regenScene, deleteScene, isReadOnly, canRegen } = useSceneActions();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
  <>
    <div style={{ marginBottom: `${6 * scale}px`, flexShrink: 0 }}>
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: `${10 * scale}px`,
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            opacity: 0.5,
            fontVariantNumeric: 'tabular-nums',
            minWidth: `${12 * scale}px`,
          }}
        >
          {displayIndex ?? scene.scene_number}
        </span>
        <span
          className="font-bold uppercase tracking-widest rounded-full"
          style={{
            fontSize: `${9 * scale}px`,
            padding: `${3 * scale}px ${8 * scale}px`,
            background: 'var(--accent-primary-soft)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--glass-border-accent)',
          }}
        >
          Scene {displayIndex ?? scene.scene_number}
        </span>
        {isBookmarked && (
          <span
            style={{
              color: '#d4a850',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.85,
            }}
            title="Bookmarked"
          >
            <svg width={13 * scale} height={13 * scale} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
        )}
        {scene.audio_url && (
          <button
            onClick={audio.togglePlay}
            style={{
              width: `${20 * scale}px`,
              height: `${20 * scale}px`,
              borderRadius: '50%',
              border: 'none',
              background: audio.playing ? 'var(--accent-primary)' : 'var(--accent-primary-soft)',
              color: audio.playing ? 'var(--text-inverse)' : 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: audio.playing ? '0 0 10px var(--accent-primary-glow)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {audio.playing ? (
              <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
        {/* Scene actions - in header row, right-aligned */}
        {!isReadOnly && !isBusy && (
          <div
            className="scene-external-actions"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: `${3 * scale}px`,
              alignItems: 'center',
            }}
          >
            {canRegen && (
              <IconBtn
                label="Regenerate scene"
                size={18 * scale}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); onRegenSceneStart?.(); regenScene?.(scene.scene_number, scene.text); }}
              >
                <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </IconBtn>
            )}
            <IconBtn
              label="Delete scene"
              size={18 * scale}
              danger
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            >
              <svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </IconBtn>
          </div>
        )}
      </div>
      {scene.scene_title && (
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: `${11 * scale}px`,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            letterSpacing: '0.02em',
            marginTop: `${3 * scale}px`,
            marginLeft: `${12 * scale + 8}px`,
          }}
        >
          {scene.scene_title}
        </div>
      )}
      {/* Audio progress bar - shown when playing */}
      {audio.playing && (
        <div
          style={{
            marginTop: `${4 * scale}px`,
            height: `${2 * scale}px`,
            background: 'var(--glass-border)',
            borderRadius: `${1 * scale}px`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${audio.progress}%`,
              background: 'var(--accent-primary)',
              boxShadow: '0 0 4px var(--accent-primary-glow)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      )}
    </div>

    {/* Delete confirmation dialog */}
    {confirmDelete && createPortal(
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)', animation: 'fadeIn 0.25s ease',
        }}
        onClick={() => setConfirmDelete(false)}
      >
        <div
          style={{
            background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)',
            borderRadius: '1.25rem', padding: '2.5rem 2.5rem 2rem',
            maxWidth: 420, width: '90%', textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4), 0 0 40px rgba(248,113,113,0.15)',
            animation: 'dialogPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, margin: '0 auto 1.25rem', borderRadius: '50%',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
            boxShadow: '0 0 24px rgba(248,113,113,0.15)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>

          <h3 style={{
            fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 0.6rem', letterSpacing: '0.01em',
          }}>Delete This Scene?</h3>

          <div style={{
            width: 40, height: 1, margin: '0 auto 0.8rem',
            background: 'linear-gradient(90deg, transparent, var(--status-error), transparent)',
            opacity: 0.4,
          }} />

          <p style={{
            fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600,
            color: 'var(--text-secondary)', margin: '0 0 0.5rem', fontStyle: 'italic',
          }}>
            Scene {displayIndex ?? scene.scene_number}
            {scene.scene_title ? ` - ${scene.scene_title}` : ''}
          </p>

          <p style={{
            color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.7,
            margin: '0 auto 2rem', maxWidth: 300,
          }}>
            This will permanently remove the scene and its media. This cannot be undone.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: '0.6rem 1.5rem', borderRadius: 999,
                fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600,
                letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                color: 'var(--text-secondary)',
              }}
            >Cancel</button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                deleteScene?.(scene.scene_number);
              }}
              style={{
                padding: '0.6rem 1.5rem', borderRadius: 999,
                fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 700,
                letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: 'none', background: 'var(--status-error)', color: '#fff',
                boxShadow: '0 4px 16px rgba(248,113,113,0.3)',
              }}
            >Delete</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </>
  );
}
