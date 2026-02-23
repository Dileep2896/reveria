import { useState } from 'react';
import { createPortal } from 'react-dom';
import './director-panel.css';
import DirectorHelpModal from './director/DirectorHelpModal';
import DirectorEmptyState from './director/DirectorEmptyState';
import DirectorAnalyzing from './director/DirectorAnalyzing';
import DirectorCardList from './director/DirectorCardList';

export default function DirectorPanel({ data, generating, sceneNumbers, sceneTitles, imageTiers, portraits = [], portraitsLoading = false, language }) {
  const isAnalyzing = generating && !data;
  const [expandedCards, setExpandedCards] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      className="director-panel overflow-y-auto flex-shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
        backdropFilter: 'var(--glass-blur-strong)',
        WebkitBackdropFilter: 'var(--glass-blur-strong)',
        borderLeft: '1px solid var(--glass-border)',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 py-4 flex items-center gap-2.5"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
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
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Director guide"
          title="What do these cards mean?"
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
      </div>

      {helpOpen && createPortal(
        <DirectorHelpModal onClose={() => setHelpOpen(false)} />,
        document.body,
      )}

      <div className="director-body">
        {!data && !isAnalyzing ? (
          <DirectorEmptyState language={language} />
        ) : isAnalyzing ? (
          <DirectorAnalyzing />
        ) : (
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
        )}
      </div>
    </div>
  );
}
