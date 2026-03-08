import Tooltip from '../Tooltip';

export default function LiveNoteItem({ note, index, isLast, playingNoteIdx, playAudio }) {
  return (
    <div
      className="director-live-note"
      style={{
        marginBottom: '10px',
        padding: '12px 14px',
        borderRadius: '12px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        animation: 'directorLiveIn 0.4s ease-out both',
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{note.emoji}</span>
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--accent-secondary)',
        }}>
          Scene {note.scene_number}
        </span>
        <span style={{
          fontSize: '9px',
          fontWeight: 600,
          padding: '2px 7px',
          borderRadius: '999px',
          background: 'var(--accent-secondary-soft)',
          color: 'var(--accent-secondary)',
          border: '1px solid var(--glass-border-secondary)',
          marginLeft: 'auto',
        }}>
          {note.mood}
        </span>
        {note.audio_url && (
          <Tooltip label={playingNoteIdx === index ? "Stop playback" : "Replay Director's voice"}>
          <button
            onClick={() => playAudio(note.audio_url, index)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: playingNoteIdx === index ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
              border: `1px solid ${playingNoteIdx === index ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
              cursor: 'pointer',
              color: 'var(--accent-secondary)',
              flexShrink: 0,
            }}
          >
            {playingNoteIdx === index ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
          </Tooltip>
        )}
      </div>
      <p style={{
        fontSize: '11px',
        lineHeight: 1.5,
        color: 'var(--text-primary)',
        margin: '0 0 6px 0',
      }}>
        {note.thought}
      </p>
      <p style={{
        fontSize: '10px',
        lineHeight: 1.4,
        color: 'var(--text-muted)',
        margin: 0,
        fontStyle: 'italic',
      }}>
        {note.craft_note}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Tension</span>
        <div style={{
          flex: 1,
          height: '4px',
          borderRadius: '2px',
          background: 'var(--glass-bg-strong)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(note.tension_level || 5) * 10}%`,
            height: '100%',
            borderRadius: '2px',
            background: (note.tension_level || 5) >= 7
              ? 'var(--status-error, #ef4444)'
              : (note.tension_level || 5) >= 4
                ? 'var(--accent-primary)'
                : 'var(--accent-secondary)',
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '14px', textAlign: 'right' }}>
          {note.tension_level}/10
        </span>
      </div>
      {note.suggestion && isLast && (
        <>
          <div style={{
            height: '1px',
            background: 'var(--glass-border)',
            margin: '10px -14px 8px',
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            <div>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent-secondary)',
              }}>
                Next Direction
              </span>
              <p style={{
                fontSize: '10px',
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                margin: '2px 0 0',
                fontWeight: 500,
              }}>
                {note.suggestion}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
