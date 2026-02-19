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

export default function ControlBar({ onSend, onSendAudio, connected, generating, inputValue, setInputValue }) {
  const [focused, setFocused] = useState(false);
  const [artStyle, setArtStyle] = useState('cinematic');

  const { recording, startRecording, stopRecording } = useVoiceCapture({
    onAudioCaptured: (base64, mimeType) => {
      if (onSendAudio) onSendAudio(base64, mimeType);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !connected || generating) return;
    onSend(inputValue.trim(), { artStyle });
    setInputValue('');
  };

  const micDisabled = !connected || generating;

  return (
    <div
      className="control-bar"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--glass-border)',
      }}
    >
      {/* Options row */}
      <div className="control-options">
        {/* Art style pills */}
        <span
          className="font-semibold uppercase tracking-wider control-style-label"
          style={{ color: 'var(--text-muted)' }}
        >
          Style
        </span>
        {ART_STYLES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setArtStyle(key)}
            className="rounded-full font-medium transition-all control-style-pill"
            style={{
              background: artStyle === key ? 'var(--accent-primary)' : 'var(--glass-bg)',
              color: artStyle === key ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: `1px solid ${artStyle === key ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
              boxShadow: artStyle === key ? 'var(--shadow-glow-primary)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="control-form"
      >
        {/* Input container — glass */}
        <div
          className="flex-1 flex items-center control-input-wrap"
          style={{
            background: 'var(--glass-bg-input)',
            border: `1px solid ${focused ? 'var(--glass-border-accent)' : 'var(--glass-border)'}`,
            boxShadow: focused ? 'var(--shadow-glow-primary)' : 'var(--shadow-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          {/* Mic button — hold to talk */}
          <button
            type="button"
            className="flex-shrink-0 rounded-xl flex items-center justify-center transition-all control-mic-btn"
            style={{
              background: recording ? 'var(--accent-primary)' : 'var(--glass-bg)',
              color: recording ? 'var(--text-inverse)' : 'var(--text-muted)',
              border: `1px solid ${recording ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
              boxShadow: recording ? '0 0 12px var(--accent-primary)' : 'none',
              animation: recording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
              opacity: micDisabled ? 0.3 : 1,
              cursor: micDisabled ? 'not-allowed' : 'pointer',
            }}
            title={recording ? 'Release to send' : 'Hold to talk'}
            onMouseDown={!micDisabled ? startRecording : undefined}
            onMouseUp={!micDisabled ? stopRecording : undefined}
            onMouseLeave={recording ? stopRecording : undefined}
            onTouchStart={!micDisabled ? (e) => { e.preventDefault(); startRecording(); } : undefined}
            onTouchEnd={!micDisabled ? (e) => { e.preventDefault(); stopRecording(); } : undefined}
            disabled={micDisabled}
          >
            <svg
              className="control-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={recording ? 'Listening...' : generating ? "Story is being crafted..." : "Describe a scenario like a mystery, an adventure, a bedtime story..."}
            className="flex-1 bg-transparent outline-none control-input"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Send button — glass with accent */}
        <button
          type="submit"
          disabled={!connected || !inputValue.trim() || generating}
          className="flex-shrink-0 font-semibold transition-all disabled:opacity-30 control-send-btn"
          style={{
            background: inputValue.trim()
              ? 'var(--accent-primary)'
              : 'var(--glass-bg)',
            color: inputValue.trim()
              ? 'var(--text-inverse)'
              : 'var(--text-muted)',
            border: `1px solid ${inputValue.trim() ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
            boxShadow: inputValue.trim() ? 'var(--shadow-glow-primary)' : 'none',
          }}
        >
          <div className="flex items-center gap-2">
            Create
            <svg
              className="control-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </button>
      </form>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 8px var(--accent-primary); }
          50% { box-shadow: 0 0 20px var(--accent-primary); }
        }
      `}</style>
    </div>
  );
}
