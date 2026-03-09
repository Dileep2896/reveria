import { useState } from 'react';

const DIMENSIONS = [
  { key: 'pacing', label: 'Pacing', color: '#a855f7' },
  { key: 'characters', label: 'Characters', color: '#f59e0b' },
  { key: 'world', label: 'World', color: '#3b82f6' },
  { key: 'dialogue', label: 'Dialogue', color: '#22c55e' },
  { key: 'coherence', label: 'Coherence', color: '#ef4444' },
];

export default function StoryHealthCard({ data }) {
  const [expanded, setExpanded] = useState(true);

  const health = data?.story_health;
  if (!health?.scores) return null;

  const scores = health.scores;
  const values = DIMENSIONS.map(d => scores[d.key] ?? 5);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

  return (
    <div className="story-health-section">
      <button className="story-health-header" onClick={() => setExpanded(p => !p)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="story-health-title">Story Health</span>
        <span className="story-health-avg">{avg}</span>
        <span className="story-health-avg-label">/ 10</span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          className="story-health-chevron"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="story-health-bars">
          {DIMENSIONS.map((dim) => {
            const val = scores[dim.key] ?? 5;
            return (
              <div key={dim.key} className="story-health-row">
                <span className="story-health-dim">{dim.label}</span>
                <div className="story-health-track">
                  <div
                    className="story-health-fill"
                    style={{
                      width: `${val * 10}%`,
                      background: dim.color,
                    }}
                  />
                </div>
                <span className="story-health-val">{val}</span>
              </div>
            );
          })}
          {health.summary && (
            <p className="story-health-summary">{health.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
