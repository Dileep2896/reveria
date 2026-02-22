import { Pill } from './directorUtils.jsx';

export default function NarrativeArcVisual({ stage, pacing, summary }) {
  const stages = ['exposition', 'rising_action', 'climax', 'falling_action', 'resolution'];
  const stageIndex = stages.indexOf(stage);
  const pacingColors = { slow: '#22c55e', moderate: '#f59e0b', fast: '#ef4444' };

  // Arc curve points (80x28 SVG)
  const arcPath = 'M4 24 Q20 24 30 14 Q40 2 40 2 Q40 2 50 14 Q60 24 76 24';
  // Dot positions along arc for each stage
  const dotPositions = [
    { x: 10, y: 22 },   // exposition
    { x: 24, y: 14 },   // rising_action
    { x: 40, y: 4 },    // climax
    { x: 56, y: 14 },   // falling_action
    { x: 70, y: 22 },   // resolution
  ];
  const dot = stageIndex >= 0 ? dotPositions[stageIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Mini arc SVG */}
        {stageIndex >= 0 && (
          <svg width="80" height="28" viewBox="0 0 80 28" style={{ flexShrink: 0 }}>
            <path
              d={arcPath}
              fill="none"
              stroke="var(--glass-border)"
              strokeWidth="1.5"
            />
            {dot && (
              <circle
                cx={dot.x}
                cy={dot.y}
                r="4"
                fill="var(--accent-secondary)"
                stroke="var(--bg-primary)"
                strokeWidth="1.5"
              >
                <animate attributeName="r" values="3.5;4.5;3.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        )}
        {/* Stage pill */}
        {stage && (
          <Pill
            label={stage.replace('_', ' ')}
            color="var(--accent-secondary)"
            bg="var(--accent-secondary-soft)"
          />
        )}
        {/* Pacing pill */}
        {pacing && (
          <Pill
            label={pacing}
            color={pacingColors[pacing] || 'var(--text-secondary)'}
            bg={`${pacingColors[pacing] || 'var(--text-muted)'}18`}
          />
        )}
      </div>
    </div>
  );
}
