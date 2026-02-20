import { useState } from 'react';
import useVoiceCapture from '../hooks/useVoiceCapture';

const ART_STYLES = [
  { key: 'cinematic', label: 'Cinematic' },
  { key: 'watercolor', label: 'Watercolor' },
  { key: 'comic', label: 'Comic Book' },
  { key: 'anime', label: 'Anime' },
  { key: 'oil', label: 'Oil Painting' },
  { key: 'pencil', label: 'Pencil Sketch' },
];

export default function ControlBar({ onSend, onSendAudio, connected, generating, quotaCooldown = 0, inputValue, setInputValue }) {
  const [focused, setFocused] = useState(false);
  const [artStyle, setArtStyle] = useState('cinematic');

  const { recording, startRecording, stopRecording } = useVoiceCapture({
    onAudioCaptured: (base64, mimeType) => {
      if (onSendAudio) onSendAudio(base64, mimeType);
    },
  });

  const isDisabled = !connected || generating || quotaCooldown > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isDisabled) return;
    onSend(inputValue.trim(), { artStyle });
    setInputValue('');
  };
  const hasText = inputValue.trim().length > 0;

  return (
    <div className="control-bar">
      <form onSubmit={handleSubmit} className="control-form">
        <div
          className="flex-1 flex items-center control-input-wrap"
          style={{
            position: 'relative',
            background: 'var(--glass-bg-input)',
            border: `1px solid ${quotaCooldown > 0 ? 'var(--status-error, #ef4444)' : generating ? 'var(--glass-border-accent)' : focused ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
            opacity: quotaCooldown > 0 ? 0.6 : 1,
            boxShadow: focused ? 'var(--shadow-glow-primary)' : 'var(--shadow-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            overflow: 'hidden',
          }}
        >
          {/* Generating shimmer overlay */}
          {generating && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRadius: 'inherit',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, var(--accent-primary-soft) 40%, var(--accent-primary-glow) 50%, var(--accent-primary-soft) 60%, transparent 100%)',
                  animation: 'controlShimmer 2s ease-in-out infinite',
                }}
              />
            </div>
          )}

          {/* Art style dropdown */}
          <select
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value)}
            className="control-style-select"
          >
            {ART_STYLES.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <div className="control-input-divider" />

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={recording ? 'Listening... click mic to stop' : quotaCooldown > 0 ? `Image quota exhausted — retry in ${quotaCooldown}s` : generating ? 'Story is being crafted...' : 'Describe a story...'}
            disabled={isDisabled}
            className="flex-1 bg-transparent outline-none control-input"
            style={{ color: 'var(--text-primary)', resize: 'none' }}
            rows={1}
          />

          {/* Single morphing action button: mic → send → spinner */}
          {generating ? (
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center control-action-btn"
              style={{
                background: 'var(--accent-primary-soft)',
                border: '1px solid var(--glass-border-accent)',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid var(--glass-border-accent)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          ) : hasText ? (
            <button
              type="submit"
              disabled={isDisabled}
              className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: '1px solid var(--accent-primary)',
                boxShadow: 'var(--shadow-glow-primary)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.3 : 1,
              }}
              title="Send"
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="flex-shrink-0 rounded-full flex items-center justify-center transition-all control-action-btn"
              style={{
                background: recording ? 'var(--accent-primary)' : 'var(--glass-bg)',
                color: recording ? 'var(--text-inverse)' : 'var(--text-muted)',
                border: `1px solid ${recording ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                boxShadow: recording ? '0 0 12px var(--accent-primary)' : 'none',
                animation: recording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
                opacity: isDisabled ? 0.3 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
              title={recording ? 'Click to stop' : 'Click to record'}
              onClick={!isDisabled ? (recording ? stopRecording : startRecording) : undefined}
              disabled={isDisabled}
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </div>
      </form>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 8px var(--accent-primary); }
          50% { box-shadow: 0 0 20px var(--accent-primary); }
        }
        @keyframes controlShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
