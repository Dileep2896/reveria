import { useState } from 'react';
import { spreadLeftPage } from '../../hooks/useStoryNavigation';

const TENSION_COLOR = (level) =>
  level >= 7 ? 'var(--status-error, #ef4444)' :
  level >= 4 ? 'var(--accent-primary)' :
  'var(--accent-secondary)';

/**
 * Build per-scene insight from multiple data sources.
 * Priority: liveNotes (richest) > directorData.directors_notes > scene metadata
 */
function getSceneInsight(sceneNum, liveNotes, directorData, scene) {
  // Latest live note for this scene
  const liveNote = [...liveNotes].reverse().find(n => n.scene_number === sceneNum);

  // Director post-batch note for this scene (1-indexed)
  const dirNote = directorData?.directors_notes?.notes?.find(n => n.scene === sceneNum);

  // Tension from director data array (0-indexed)
  const tensionLevels = directorData?.tension?.levels;
  const dirTension = tensionLevels?.[sceneNum - 1];

  // Emotional arc value (-1 to 1) → mood hint
  const emotionalValues = directorData?.emotional_arc?.values;
  const emotionalVal = emotionalValues?.[sceneNum - 1];

  return {
    emoji: liveNote?.emoji || (emotionalVal > 0.3 ? '✨' : emotionalVal < -0.3 ? '🌑' : '📖'),
    mood: liveNote?.mood || '',
    tension: liveNote?.tension_level ?? dirTension ?? 5,
    thought: liveNote?.craft_note || liveNote?.thought || dirNote?.note || '',
    title: scene?.scene_title || '',
  };
}

function SceneInsightCard({ insight, sceneNum, side, expanded, onToggle }) {
  if (!insight) return (
    <div className="scene-insight-card scene-insight-empty">
      <span className="scene-insight-num">—</span>
    </div>
  );

  const { emoji, mood, tension, thought, title } = insight;

  return (
    <div
      className={`scene-insight-card scene-insight-${side}${expanded ? ' expanded' : ''}`}
      onClick={thought ? onToggle : undefined}
      style={thought ? { cursor: 'pointer' } : undefined}
    >
      <div className="scene-insight-header">
        <span className="scene-insight-emoji">{emoji}</span>
        <span className="scene-insight-num">S{sceneNum}</span>
      </div>
      {title && (
        <p className="scene-insight-title">{title}</p>
      )}
      {mood && (
        <span className="scene-insight-mood">{mood}</span>
      )}
      <div className="scene-insight-tension">
        <span className="scene-insight-tension-label">Tension</span>
        <div className="scene-insight-tension-track">
          <div
            className="scene-insight-tension-fill"
            style={{
              width: `${tension * 10}%`,
              background: TENSION_COLOR(tension),
            }}
          />
        </div>
        <span className="scene-insight-tension-val">{tension}</span>
      </div>
      {thought && (
        <p className={`scene-insight-note${expanded ? ' expanded' : ''}`}>{thought}</p>
      )}
    </div>
  );
}

export default function SceneInsightPair({ currentSceneNumber, scenes, liveNotes, directorData, singlePage }) {
  const [expandedLeft, setExpandedLeft] = useState(false);
  const [expandedRight, setExpandedRight] = useState(false);

  if (!currentSceneNumber || !scenes.length) return null;

  const leftPage = singlePage ? currentSceneNumber : spreadLeftPage(currentSceneNumber);
  const rightPage = singlePage ? null : leftPage + 1;

  const leftScene = scenes.find(s => s.scene_number === leftPage);
  const rightScene = rightPage ? scenes.find(s => s.scene_number === rightPage) : null;

  // Don't render if neither scene exists
  if (!leftScene && !rightScene) return null;

  const leftInsight = leftScene ? getSceneInsight(leftPage, liveNotes, directorData, leftScene) : null;
  const rightInsight = rightScene ? getSceneInsight(rightPage, liveNotes, directorData, rightScene) : null;

  const showSingle = singlePage || !rightScene;

  return (
    <div className="scene-insight-section">
      <div className="scene-insight-label">Now Viewing</div>
      <div className={`scene-insight-pair${showSingle ? ' scene-insight-single' : ''}`}>
        <SceneInsightCard insight={leftInsight} sceneNum={leftPage} side="left" expanded={expandedLeft} onToggle={() => setExpandedLeft(p => !p)} />
        {!showSingle && (
          <SceneInsightCard insight={rightInsight} sceneNum={rightPage} side="right" expanded={expandedRight} onToggle={() => setExpandedRight(p => !p)} />
        )}
      </div>
    </div>
  );
}
