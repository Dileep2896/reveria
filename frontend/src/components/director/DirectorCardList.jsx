import { CARDS, normalizeCardData, hasVisualFields, ChevronToggle, ShimmerVisual } from './directorUtils.jsx';
import NarrativeArcVisual from './NarrativeArcVisual';
import CharactersVisual from './CharactersVisual';
import TensionVisual from './TensionVisual';
import VisualStyleVisual from './VisualStyleVisual';
import IllustrationsCard from './IllustrationsCard';
import PortraitGallery from './PortraitGallery';

export default function DirectorCardList({ data, expandedCards, toggleCard, sceneNumbers, sceneTitles, imageTiers, portraits, portraitsLoading }) {
  return (
    <>
      <p
        className="text-xs leading-relaxed mb-5"
        style={{ color: 'var(--text-muted)' }}
      >
        Creative analysis of the current story.
      </p>

      {CARDS.map(({ key, label, icon }) => {
        const content = normalizeCardData(key, data?.[key]);
        const expanded = !!expandedCards[key];
        const showChevron = content && (hasVisualFields(key, content) || content.detail);

        return (
          <div
            key={key}
            className="mb-3 p-3.5 rounded-xl"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'var(--glass-blur)',
              animation: 'fadeIn 0.4s ease',
            }}
          >
            {/* Card header */}
            <div
              className="flex items-center gap-2 mb-2.5"
              style={{ cursor: showChevron ? 'pointer' : 'default' }}
              onClick={() => showChevron && toggleCard(key)}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={icon} />
              </svg>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--accent-secondary)', flex: 1 }}
              >
                {label}
              </span>
              {showChevron && (
                <ChevronToggle
                  expanded={expanded}
                  onClick={(e) => { e.stopPropagation(); toggleCard(key); }}
                />
              )}
            </div>

            {content ? (
              <>
                {hasVisualFields(key, content) ? (
                  <>
                    {key === 'narrative_arc' && (
                      <NarrativeArcVisual
                        stage={content.stage}
                        pacing={content.pacing}
                        summary={content.summary}
                      />
                    )}
                    {key === 'characters' && (
                      <CharactersVisual
                        list={content.list}
                        summary={content.summary}
                      />
                    )}
                    {key === 'tension' && (
                      <TensionVisual
                        levels={content.levels}
                        trend={content.trend}
                        summary={content.summary}
                        sceneNumbers={sceneNumbers}
                        sceneTitles={sceneTitles}
                      />
                    )}
                    {key === 'visual_style' && (
                      <VisualStyleVisual
                        tags={content.tags}
                        mood={content.mood}
                        summary={content.summary}
                      />
                    )}
                  </>
                ) : (
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {content.detail}
                  </p>
                )}

                {expanded && content.detail && hasVisualFields(key, content) && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--glass-border)',
                    animation: 'detailFadeIn 0.2s ease',
                  }}>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--text-muted)', margin: 0 }}
                    >
                      {content.detail}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <ShimmerVisual />
            )}
          </div>
        );
      })}

      <IllustrationsCard imageTiers={imageTiers} />

      <PortraitGallery
        portraits={portraits}
        portraitsLoading={portraitsLoading}
      />
    </>
  );
}
