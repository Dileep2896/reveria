/**
 * Compact panels showing characters, visual style, themes, emotional arc, and next direction.
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
            <div className="story-details-icon story-details-icon--suggestion">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
              </svg>
            </div>
            <span className="story-details-card-title" style={{ color: 'var(--accent-primary)' }}>Next Direction</span>
          </div>
          <p className="story-details-text">{lastSuggestion}</p>
        </div>
      )}

      {/* Characters */}
      {hasCharacters && (
        <div className="story-details-card story-details-card--characters">
          <div className="story-details-card-header">
            <div className="story-details-icon story-details-icon--characters">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="story-details-card-title">Characters</span>
          </div>
          {characters.summary && (
            <p className="story-details-summary">{characters.summary}</p>
          )}
          <div className="story-details-pills">
            {characters.list.map((c, i) => {
              const name = typeof c === 'string' ? c : c.name;
              const role = typeof c === 'string' ? null : c.role;
              return (
                <span key={i} className="story-details-chip story-details-chip--character">
                  <span className="story-details-chip-avatar">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="story-details-chip-name">{name}</span>
                  {role && <span className="story-details-chip-role">{role}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Style + Mood */}
      {hasStyle && (
        <div className="story-details-card story-details-card--style">
          <div className="story-details-card-header">
            <div className="story-details-icon story-details-icon--style">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
            <span className="story-details-card-title">Visual Style</span>
            {visualStyle.mood && (
              <span className="story-details-mood-badge">{visualStyle.mood}</span>
            )}
          </div>
          {visualStyle.tags?.length > 0 && (
            <div className="story-details-tags">
              {visualStyle.tags.map((tag, i) => (
                <span key={i} className="story-details-tag" style={{ animationDelay: `${i * 0.05}s` }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Themes */}
      {hasThemes && (
        <div className="story-details-card story-details-card--themes">
          <div className="story-details-card-header">
            <div className="story-details-icon story-details-icon--themes">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="story-details-card-title">Themes</span>
          </div>
          <div className="story-details-theme-list">
            {themes.themes.map((t, i) => {
              const name = typeof t === 'string' ? t : t.name;
              return (
                <div key={i} className="story-details-theme-item" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="story-details-theme-dot" />
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emotional Arc */}
      {hasEmotion && (
        <div className="story-details-card story-details-card--emotion">
          <div className="story-details-card-header">
            <div className="story-details-icon story-details-icon--emotion">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="story-details-card-title">Emotional Arc</span>
          </div>
          <div className="story-details-emotion-row">
            {emotional.dominant_emotion && (
              <span className="story-details-emotion-badge">
                {emotional.dominant_emotion}
              </span>
            )}
            {emotional.arc_shape && (
              <span className="story-details-arc-badge">
                {emotional.arc_shape.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {emotional.summary && (
            <p className="story-details-summary story-details-emotion-summary">{emotional.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
