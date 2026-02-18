import { useState } from 'react';
import { useTheme } from './contexts/ThemeContext';
import useWebSocket from './hooks/useWebSocket';
import Logo from './components/Logo';
import StoryCanvas from './components/StoryCanvas';
import DirectorPanel from './components/DirectorPanel';
import ControlBar from './components/ControlBar';

export default function App() {
  const { connected, messages, generating, send } = useWebSocket();
  const { theme, toggleTheme } = useTheme();
  const [directorOpen, setDirectorOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Background layer with gradient + color orbs */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <div className="absolute inset-0" style={{ background: 'var(--orb-1)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-2)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--orb-3)' }} />
        {/* Noise texture for depth */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header — frosted glass */}
      <header
        className="relative z-10 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-glass)',
        }}
      >
        <Logo size="compact" />

        <div className="flex items-center gap-3">
          {/* Connection status pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? 'var(--status-success)' : 'var(--status-error)',
                boxShadow: connected
                  ? '0 0 8px var(--status-success)'
                  : '0 0 8px var(--status-error)',
              }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Director toggle — glass pill */}
          <button
            onClick={() => setDirectorOpen(!directorOpen)}
            className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all uppercase tracking-wider"
            style={{
              background: directorOpen ? 'var(--accent-secondary-soft)' : 'var(--glass-bg)',
              color: directorOpen ? 'var(--accent-secondary)' : 'var(--text-muted)',
              border: `1px solid ${directorOpen ? 'var(--glass-border-secondary)' : 'var(--glass-border)'}`,
              backdropFilter: 'var(--glass-blur)',
              boxShadow: directorOpen ? 'var(--shadow-glow-secondary)' : 'none',
            }}
          >
            Director
          </button>

          {/* Theme toggle — glass circle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              backdropFilter: 'var(--glass-blur)',
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        <StoryCanvas messages={messages} generating={generating} />
        {directorOpen && <DirectorPanel messages={messages} />}
      </div>

      {/* Control Bar */}
      <div className="relative z-10">
        <ControlBar onSend={send} connected={connected} generating={generating} />
      </div>
    </div>
  );
}
