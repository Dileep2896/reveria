import { useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import './director-panel.css';
import DirectorHelpModal from './director/DirectorHelpModal';
import DirectorEmptyState from './director/DirectorEmptyState';
import DirectorAnalyzing from './director/DirectorAnalyzing';
import DirectorCardList from './director/DirectorCardList';
import DirectorChat from './DirectorChat';
import LiveAgentCTA from './director/LiveAgentCTA';
import LiveNoteItem from './director/LiveNoteItem';
import useDirectorAudioPlayback from '../hooks/useDirectorAudioPlayback';

export default function DirectorPanel({
  singlePage = false, heroMode, template,
  data, generating, sceneNumbers, sceneTitles, imageTiers,
  portraits = [], portraitsLoading = false, language, liveNotes = [],
  chatActive, chatMessages = [], chatLoading, chatPrompt,
  autoGenerate, onCancelAutoGenerate, castAnalyzing = false,
  onStartChat, onEndChat, onChatAudio, onChatSuggest, onUsePrompt,
}) {
  const isAnalyzing = generating && !data;
  const hasLiveNotes = liveNotes.length > 0;
  const [expandedCards, setExpandedCards] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [liveNotesOpen, setLiveNotesOpen] = useState(true);
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

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
      <div
        className="px-5 py-4 flex items-center gap-2.5"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--accent-secondary-soft)',
            border: '1px solid var(--glass-border-secondary)',
            boxShadow: 'var(--shadow-glow-secondary)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--accent-secondary)', flex: 1 }}
        >
          Director
        </h2>
        {heroMode?.active && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              color: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)',
              border: '1px solid var(--glass-border-accent)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Hero
          </span>
        )}
        {language && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              color: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)',
              border: '1px solid var(--glass-border-accent)',
              letterSpacing: '0.03em',
            }}
          >
            {language}
          </span>
        )}
        <Tooltip label="What do these cards mean?">
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Director guide"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-secondary-soft)';
            e.currentTarget.style.color = 'var(--accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
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

      {/* Voice chat orb — above the notes */}
      {chatActive && (
        <DirectorChat
          onSendAudio={onChatAudio}
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
        />
      )}

      {/* Scrollable notes + cards body */}
      <div className="director-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Live commentary during generation */}
        {hasLiveNotes && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setLiveNotesOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: liveNotesOpen ? '12px' : 0,
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--accent-primary-soft)',
                border: '1px solid var(--glass-border-accent)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                animation: generating ? 'analyzePulse 2s ease-in-out infinite' : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent-primary)',
                flex: 1,
              }}>
                {generating ? 'Live Commentary' : "Director's Notes"}
              </span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: liveNotesOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M1 1l4 4 4-4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

        {!data && !isAnalyzing && !hasLiveNotes ? (
          <DirectorEmptyState language={language} />
        ) : isAnalyzing && !hasLiveNotes ? (
          <DirectorAnalyzing />
        ) : data ? (
          <DirectorCardList
            data={data}
            expandedCards={expandedCards}
            toggleCard={toggleCard}
            sceneNumbers={sceneNumbers}
            sceneTitles={sceneTitles}
            imageTiers={imageTiers}
            portraits={portraits}
            portraitsLoading={portraitsLoading}
          />
        ) : isAnalyzing ? (
          <DirectorAnalyzing />
        ) : null}
      </div>
    </div>
  );
}
