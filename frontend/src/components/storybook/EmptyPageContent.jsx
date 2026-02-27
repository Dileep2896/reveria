import { memo, useState, useEffect, useRef } from 'react';
import './EmptyPageContent.css';

const PROMPTS = [
  'Meanwhile, in a distant land\u2026',
  'The door creaked open\u2026',
  'She never looked back\u2026',
  'In the silence, a voice whispered\u2026',
  'Beyond the horizon, something stirred\u2026',
  'And then, everything changed\u2026',
];

const TYPE_SPEED = 60;   // ms per character typing
const HOLD_TIME = 2200;  // ms to hold full text
const ERASE_SPEED = 35;  // ms per character erasing
const PAUSE_TIME = 600;  // ms pause between prompts

const EmptyPageContent = memo(({ scale = 1 }) => {
  const [promptIdx, setPromptIdx] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState('typing'); // typing | holding | erasing | pausing
  const timerRef = useRef(null);

  useEffect(() => {
    const prompt = PROMPTS[promptIdx];

    if (phase === 'typing') {
      if (displayed.length < prompt.length) {
        timerRef.current = setTimeout(() => {
          setDisplayed(prompt.slice(0, displayed.length + 1));
        }, TYPE_SPEED);
      } else {
        timerRef.current = setTimeout(() => setPhase('holding'), 0);
      }
    } else if (phase === 'holding') {
      timerRef.current = setTimeout(() => setPhase('erasing'), HOLD_TIME);
    } else if (phase === 'erasing') {
      if (displayed.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, ERASE_SPEED);
      } else {
        timerRef.current = setTimeout(() => setPhase('pausing'), 0);
      }
    } else if (phase === 'pausing') {
      timerRef.current = setTimeout(() => {
        setPromptIdx((promptIdx + 1) % PROMPTS.length);
        setPhase('typing');
      }, PAUSE_TIME);
    }

    return () => clearTimeout(timerRef.current);
  }, [displayed, phase, promptIdx]);

  return (
    <div className="empty-page" style={{ padding: `${24 * scale}px` }}>
      {/* Typewriter text */}
      <div className="empty-page-typewriter">
        <span
          className="empty-page-typed"
          style={{ fontSize: `${Math.max(11, 13 * scale)}px` }}
        >
          {displayed}
        </span>
        <span className="empty-page-cursor" style={{ height: `${Math.max(14, 16 * scale)}px` }} />
      </div>

      {/* Ornamental flourish */}
      <div className="empty-page-flourish" style={{ marginTop: `${16 * scale}px`, marginBottom: `${12 * scale}px` }}>
        <span className="empty-page-flourish-line" />
        <span className="empty-page-flourish-dot">&diams;</span>
        <span className="empty-page-flourish-line" />
      </div>

      {/* Subtitle */}
      <p
        className="empty-page-subtitle"
        style={{ fontSize: `${Math.max(8, 9 * scale)}px` }}
      >
        Type a prompt to continue the story
      </p>
    </div>
  );
});

export default EmptyPageContent;
