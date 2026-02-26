import { Pill } from './directorUtils.jsx';

const emotionColors = {
  joy: '#eab308',
  sadness: '#6366f1',
  fear: '#a855f7',
  anger: '#ef4444',
  surprise: '#f59e0b',
  disgust: '#22c55e',
  trust: '#3b82f6',
  hope: '#22d3ee',
};

const arcLabels = {
  rags_to_riches: 'Rags to Riches',
  riches_to_rags: 'Riches to Rags',
  man_in_hole: 'Man in a Hole',
  icarus: 'Icarus',
  cinderella: 'Cinderella',
  oedipus: 'Oedipus',
};

export default function EmotionalArcVisual({ values, dominant_emotion, arc_shape, summary }) {
  if (!values || !values.length) return null;

  const w = 80;
  const h = 32;
  const pad = 2;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (values.length === 1 ? usableW / 2 : (i / (values.length - 1)) * usableW);
    const y = pad + ((1 - v) / 2) * usableH; // -1 bottom, +1 top
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${line} L${points[points.length - 1].x.toFixed(1)},${h} L${points[0].x.toFixed(1)},${h} Z`;
  const midY = pad + usableH / 2;
  const emotionColor = emotionColors[dominant_emotion] || '#a855f7';
  const lastPt = points[points.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        style={{ height: 'auto', maxHeight: '48px', borderRadius: '6px', overflow: 'visible' }}
      >
        {/* Dashed zero-line */}
        <line
          x1={pad} y1={midY} x2={w - pad} y2={midY}
          stroke="var(--glass-border)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        {/* Gradient defs */}
        <defs>
          <linearGradient id="eaGradPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="eaGradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* Fill area above zero */}
        <clipPath id="clipAbove"><rect x="0" y="0" width={w} height={midY} /></clipPath>
        <path d={areaPath} fill="url(#eaGradPos)" clipPath="url(#clipAbove)" />
        {/* Fill area below zero */}
        <clipPath id="clipBelow"><rect x="0" y={midY} width={w} height={h - midY} /></clipPath>
        <path d={areaPath} fill="url(#eaGradNeg)" clipPath="url(#clipBelow)" />
        {/* Line */}
        <path
          d={line}
          fill="none"
          stroke={emotionColor}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="200"
          strokeDashoffset="0"
          style={{ animation: 'sparklineDraw 1.2s ease forwards' }}
        />
        {/* End dot */}
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r="2"
          fill={emotionColor}
          style={{ animation: 'directorIdlePulse 2s ease-in-out infinite' }}
        />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {dominant_emotion && (
          <Pill
            label={dominant_emotion}
            color={emotionColor}
            bg={`${emotionColor}18`}
          />
        )}
        {arc_shape && (
          <Pill
            label={arcLabels[arc_shape] || arc_shape}
            color="var(--text-secondary)"
          />
        )}
      </div>
    </div>
  );
}
