/**
 * Compact panels showing characters, visual style, themes, and next direction.
 * Only renders sections that have data.
 */
export default function StoryDetails({ data, liveNotes }) {
  const characters = data?.characters;
  const visualStyle = data?.visual_style;
  const themes = data?.themes;
  const emotional = data?.emotional_arc;

  // Director's suggestion from latest live note
  const lastSuggestion = [...(liveNotes || [])].reverse().find(n => n.suggestion)?.suggestion;

  const hasCharacters = characters?.list?.length > 0;
  const hasStyle = visualStyle?.tags?.length > 0 || visualStyle?.mood;
  const hasThemes = themes?.themes?.length > 0;
  const hasEmotion = emotional?.dominant_emotion || emotional?.arc_shape;
  const hasSuggestion = !!lastSuggestion;

  if (!hasCharacters && !hasStyle && !hasThemes && !hasEmotion && !hasSuggestion) return null;

  return (
    <div className="story-details-section">
      {/* Next Direction */}
      {hasSuggestion && (
        <div className="story-details-card story-details-suggestion">
          <div className="story-details-card-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            <span className="story-details-card-title" style={{ color: 'var(--accent-primary)' }}>Next Direction</span>
          </div>
          <p className="story-details-text">{lastSuggestion}</p>
        </div>
      )}

      {/* Characters */}
      {hasCharacters && (
        <div className="story-details-card">
          <div className="story-details-card-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="story-details-card-title">Characters</span>
          </div>
          {characters.summary && (
            <p className="story-details-summary">{characters.summary}</p>
          )}
          <div className="story-details-pills">
            {characters.list.map((c, i) => (
              <span key={i} className="story-details-pill">
                {typeof c === 'string' ? c : `${c.name}${c.role ? ` · ${c.role}` : ''}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual Style + Mood */}
      {hasStyle && (
        <div className="story-details-card">
          <div className="story-details-card-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            <span className="story-details-card-title">Visual Style</span>
          </div>
          {visualStyle.mood && (
            <p className="story-details-summary">{visualStyle.mood}</p>
          )}
          {visualStyle.tags?.length > 0 && (
            <div className="story-details-pills">
              {visualStyle.tags.map((tag, i) => (
                <span key={i} className="story-details-pill">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Themes */}
      {hasThemes && (
        <div className="story-details-card">
          <div className="story-details-card-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="story-details-card-title">Themes</span>
          </div>
          <div className="story-details-pills">
            {themes.themes.map((t, i) => (
              <span key={i} className="story-details-pill">
                {typeof t === 'string' ? t : t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Emotional Arc */}
      {hasEmotion && (
        <div className="story-details-card">
          <div className="story-details-card-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="story-details-card-title">Emotional Arc</span>
          </div>
          <div className="story-details-pills">
            {emotional.dominant_emotion && (
              <span className="story-details-pill">{emotional.dominant_emotion}</span>
            )}
            {emotional.arc_shape && (
              <span className="story-details-pill">{emotional.arc_shape.replace(/_/g, ' ')}</span>
            )}
          </div>
          {emotional.summary && (
            <p className="story-details-summary">{emotional.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
