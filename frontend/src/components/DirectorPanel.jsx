import { useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import './director-panel.css';
import DirectorHelpModal from './director/DirectorHelpModal';
import DirectorEmptyState from './director/DirectorEmptyState';
import DirectorAnalyzing from './director/DirectorAnalyzing';
import DirectorChat from './DirectorChat';
import LiveAgentCTA from './director/LiveAgentCTA';
import LiveNoteItem from './director/LiveNoteItem';
import SceneInsightPair from './director/SceneInsightPair';
import StoryHealthCard from './director/StoryHealthCard';
import StoryDetails from './director/StoryDetails';
import useDirectorAudioPlayback from '../hooks/useDirectorAudioPlayback';

export default function DirectorPanel({
  singlePage = false, heroMode, template,
  data, generating, scenes = [], currentSceneNumber, language, liveNotes = [],
  chatActive, chatMessages = [], chatLoading, chatPrompt,
  autoGenerate, onCancelAutoGenerate, castAnalyzing = false, demoSpeaking = false, demoListening = false,
  onStartChat, onEndChat, onChatAudio, onChatAudioChunk, onChatAudioStreamStart, onChatAudioStreamEnd,
  onChatNudge, onChatSuggest, onUsePrompt,
  setAudioChunkHandler, setAudioDoneHandler,
}) {
  const hasLiveNotes = liveNotes.length > 0;
  const hasScenes = scenes.length > 0;
  const [helpOpen, setHelpOpen] = useState(false);
  const [liveNotesOpen, setLiveNotesOpen] = useState(false);

  const { playingNoteIdx, playAudio } = useDirectorAudioPlayback(liveNotes, chatActive);

  return (
    <div
      className={`director-panel flex-shrink-0${singlePage ? ' director-panel--wide' : ''}`}
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
        backdropFilter: 'var(--glass-blur-strong)',
        WebkitBackdropFilter: 'var(--glass-blur-strong)',
        borderLeft: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="director-panel-header">
        <div className="director-panel-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Clapperboard body */}
            <rect x="2" y="8" width="20" height="14" rx="2" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            {/* Clapper top (angled open) */}
            <path d="M2 8L4 3h16l2 5" stroke="var(--accent-secondary)" strokeWidth="1.8" />
            {/* Diagonal stripes on clapper */}
            <line x1="7" y1="3" x2="8.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="12" y1="3" x2="13.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
            <line x1="17" y1="3" x2="18.5" y2="8" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.6" />
          </svg>
        </div>
        <h2 className="director-panel-title">Director</h2>
        {heroMode?.active && <span className="director-badge director-badge-hero">Hero</span>}
        {language && <span className="director-badge director-badge-lang">{language}</span>}
        <Tooltip label="Director guide">
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="Director guide"
            className="director-help-btn"
          >
            ?
          </button>
        </Tooltip>
      </div>

      {helpOpen && createPortal(
        <DirectorHelpModal onClose={() => setHelpOpen(false)} />,
        document.body,
      )}

      {/* Live Agent CTA */}
      {!chatActive && <LiveAgentCTA onStartChat={onStartChat} disabled={template === 'hero' && !heroMode?.active} />}

      {/* Voice chat orb */}
      {chatActive && (
        <DirectorChat
          onSendAudio={onChatAudio}
          onSendAudioChunk={onChatAudioChunk}
          onAudioStreamStart={onChatAudioStreamStart}
          onAudioStreamEnd={onChatAudioStreamEnd}
          onSendText={onChatNudge}
          onNudge={onChatNudge}
          onEndChat={onEndChat}
          onSuggestPrompt={onChatSuggest}
          onUsePrompt={onUsePrompt}
          messages={chatMessages}
          suggestedPrompt={chatPrompt}
          chatLoading={chatLoading}
          autoGenerate={autoGenerate}
          onCancelAutoGenerate={onCancelAutoGenerate}
          generating={generating}
          castAnalyzing={castAnalyzing || !!heroMode?.analyzing}
          demoSpeaking={demoSpeaking}
          demoListening={demoListening}
          setAudioChunkHandler={setAudioChunkHandler}
          setAudioDoneHandler={setAudioDoneHandler}
        />
      )}

      {/* Scrollable body */}
      <div className="director-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {!hasScenes && !hasLiveNotes ? (
          generating ? <DirectorAnalyzing /> : <DirectorEmptyState language={language} />
        ) : (
          <>
            {/* Analyzing skeleton while generating and no director data yet */}
            {generating && !data && <DirectorAnalyzing />}

            {/* Scene Insight — two side-by-side cards for current spread */}
            <SceneInsightPair
              currentSceneNumber={currentSceneNumber}
              scenes={scenes}
              liveNotes={liveNotes}
              directorData={data}
              singlePage={singlePage}
            />

            {/* Story Health — single compact dashboard */}
            <StoryHealthCard data={data} />

            {/* Characters, Visual Style, Themes, Next Direction */}
            <StoryDetails data={data} liveNotes={liveNotes} />

            {/* Live Notes — collapsible, shows full commentary */}
            {hasLiveNotes && (
              <div className="director-live-section">
                <button
                  className="director-live-toggle"
                  onClick={() => setLiveNotesOpen(prev => !prev)}
                >
                  <div className={`director-live-dot${generating ? ' active' : ''}`} />
                  <span className="director-live-label">
                    {generating ? 'Live Commentary' : 'All Notes'}
                  </span>
                  <span className="director-live-count">{liveNotes.length}</span>
                  <svg
                    width="10" height="6" viewBox="0 0 10 6" fill="none"
                    style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: liveNotesOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    <path d="M1 1l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {liveNotesOpen && liveNotes.map((note, i) => (
                  <LiveNoteItem
                    key={`live-${note.scene_number}-${i}`}
                    note={note}
                    index={i}
                    isLast={i === liveNotes.length - 1}
                    playingNoteIdx={playingNoteIdx}
                    playAudio={playAudio}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
