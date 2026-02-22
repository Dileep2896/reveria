import { Pill } from './directorUtils.jsx';
import TensionBars from './TensionBars';

export default function TensionVisual({ levels, trend, summary, sceneNumbers, sceneTitles }) {
  const trendIcons = { rising: '\u2197', falling: '\u2198', steady: '\u2192', volatile: '\u2195' };
  const trendColors = { rising: '#ef4444', falling: '#22c55e', steady: '#f59e0b', volatile: '#a855f7' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {summary && (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, flex: '1 1 auto' }}>
            {summary}
          </p>
        )}
        {trend && (
          <Pill
            label={`${trendIcons[trend] || ''} ${trend}`}
            color={trendColors[trend] || 'var(--text-secondary)'}
            bg={`${trendColors[trend] || 'var(--text-muted)'}18`}
          />
        )}
      </div>
      <TensionBars tension={{ levels }} sceneNumbers={sceneNumbers} sceneTitles={sceneTitles} />
    </div>
  );
}
