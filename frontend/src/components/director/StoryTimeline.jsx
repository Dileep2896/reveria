import { useState } from 'react';
import { spreadLeftPage } from '../../hooks/useStoryNavigation';

const fmt = (s) => s?.replace(/_/g, ' ') || '';

const TENSION_COLOR = (level) =>
  level >= 7 ? '#ef4444' :
  level >= 4 ? 'var(--accent-primary)' :
  'var(--accent-secondary)';

function getTension(sceneNum, sceneMap, data) {
  const liveNote = sceneMap.get(sceneNum);
  if (liveNote?.tension_level != null) return liveNote.tension_level;
  const dirLevels = data?.tension?.levels;
  if (dirLevels?.[sceneNum - 1] != null) return dirLevels[sceneNum - 1];
  return 5;
}

export default function StoryTimeline({ liveNotes, currentSceneNumber, data, scenes, singlePage }) {
  const [expanded, setExpanded] = useState(true);

  if (!scenes.length) return null;

  const sceneMap = new Map();
  for (const note of liveNotes) {
    sceneMap.set(note.scene_number, note);
  }

  const leftPage = currentSceneNumber ? (singlePage ? currentSceneNumber : spreadLeftPage(currentSceneNumber)) : null;
  const rightPage = leftPage && !singlePage ? leftPage + 1 : null;

  const arc = data?.narrative_arc;
  const beats = data?.beats;

  return (
    <div className="story-timeline-section">
      <button className="story-timeline-header" onClick={() => setExpanded(p => !p)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="story-timeline-title">Story Arc</span>
        {arc?.stage && (
          <span className="story-timeline-stage">{fmt(arc.stage)}</span>
        )}
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          className="story-timeline-chevron"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="story-timeline-body">
          {/* Compact inline dot strip */}
          <div className="story-arc-strip">
            {scenes.map((scene, i) => {
              const num = scene.scene_number;
              const t = getTension(num, sceneMap, data);
              const isActive = num === leftPage || num === rightPage;
              const color = TENSION_COLOR(t);

              return (
                <div key={num} className="story-arc-item">
                  {i > 0 && <div className="story-arc-line" />}
                  <div
                    className={`story-arc-dot${isActive ? ' active' : ''}`}
                    style={{ background: color, boxShadow: isActive ? `0 0 8px ${color}` : 'none' }}
                    title={`S${num} — tension ${t}/10`}
                  />
                  <span className={`story-arc-label${isActive ? ' active' : ''}`}>S{num}</span>
                </div>
              );
            })}
          </div>

          {/* Pills */}
          <div className="story-timeline-info">
            {arc?.pacing && (
              <span className="story-timeline-pill">{fmt(arc.pacing)}</span>
            )}
            {beats?.current_beat && (
              <span className="story-timeline-pill">{fmt(beats.current_beat)}</span>
            )}
            {beats?.next_expected && (
              <span className="story-timeline-pill story-timeline-pill-next">
                → {fmt(beats.next_expected)}
              </span>
            )}
          </div>

          {arc?.summary && (
            <p className="story-timeline-summary">{arc.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
