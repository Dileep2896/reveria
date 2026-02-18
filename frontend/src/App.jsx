import useWebSocket from './hooks/useWebSocket';
import StoryCanvas from './components/StoryCanvas';
import DirectorPanel from './components/DirectorPanel';
import ControlBar from './components/ControlBar';

export default function App() {
  const { connected, messages, send } = useWebSocket();

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a]">
      {/* Header */}
      <header className="border-b border-[#2a2a4a] px-6 py-3 flex items-center justify-between bg-[#12121f]">
        <h1 className="text-xl font-bold text-white tracking-tight">
          StoryForge
        </h1>
        <span className="text-xs text-[#64748b]">
          {connected ? 'Connected' : 'Reconnecting...'}
        </span>
      </header>

      {/* Main content: Story Canvas + Director Panel */}
      <div className="flex flex-1 overflow-hidden">
        <StoryCanvas messages={messages} />
        <DirectorPanel messages={messages} />
      </div>

      {/* Control Bar */}
      <ControlBar onSend={send} connected={connected} />
    </div>
  );
}
