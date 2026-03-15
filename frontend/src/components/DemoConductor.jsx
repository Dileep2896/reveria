import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const DEMO_STEPS = [
  { id: 'intro',        cue: 'Director greets judges. Let it speak.',           duration: 20 },
  { id: 'templates',    cue: 'Director mentions templates. Pick one.',          duration: 20 },
  { id: 'brainstorm',   cue: 'Chat with Director. Confirm when ready.',        duration: 30 },
  { id: 'gen1',         cue: 'Generating scene 1...', autoSlide: 'pipeline',   duration: 30 },
  { id: 'reveal1',      cue: 'Scene revealed! Let Director comment.',          duration: 20 },
  { id: 'director_gen', cue: 'Director generates scene 2 itself.',             duration: 20 },
  { id: 'gen2',         cue: 'Generating scene 2...', autoSlide: 'director',   duration: 30 },
  { id: 'features',     cue: 'Show: Publish / PDF / Reading mode.',            duration: 20 },
  { id: 'slides',       cue: 'Architecture slides. (` + 1-5)',                 duration: 15, autoSlide: 'cloud' },
  { id: 'wrapup',       cue: 'Director wraps up. Let it finish.',              duration: 15 },
];

export default function DemoConductor({ generating, onSlideRequest, onClose }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const prevGenerating = useRef(generating);

  const step = DEMO_STEPS[stepIdx] || DEMO_STEPS[DEMO_STEPS.length - 1];
  const totalElapsed = Math.floor((Date.now() - startTime.current) / 1000);

  // Timer tick
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-advance on generating transitions
  useEffect(() => {
    const wasGenerating = prevGenerating.current;
    prevGenerating.current = generating;

    // Generation started during brainstorm → advance to gen1
    if (!wasGenerating && generating && step.id === 'brainstorm') {
      setStepIdx(i => i + 1);
    }
    // Generation ended during gen1 → advance to reveal1
    if (wasGenerating && !generating && step.id === 'gen1') {
      setTimeout(() => setStepIdx(i => i + 1), 1500);
    }
    // Generation started during director_gen → advance to gen2
    if (!wasGenerating && generating && step.id === 'director_gen') {
      setStepIdx(i => i + 1);
    }
    // Generation ended during gen2 → advance to features
    if (wasGenerating && !generating && step.id === 'gen2') {
      setTimeout(() => setStepIdx(i => i + 1), 1500);
    }
  }, [generating, step.id]);

  // Auto-slides on step entry
  useEffect(() => {
    if (step.autoSlide && onSlideRequest) {
      onSlideRequest(step.autoSlide);
    }
  }, [stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIdx(i => Math.min(i + 1, DEMO_STEPS.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIdx(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const advance = useCallback(() => {
    setStepIdx(i => Math.min(i + 1, DEMO_STEPS.length - 1));
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      padding: '0.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      fontFamily: 'Outfit, sans-serif',
      animation: 'fadeIn 0.25s ease',
      userSelect: 'none',
    }}>
      {/* Step dots */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {DEMO_STEPS.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setStepIdx(i)}
            style={{
              width: i === stepIdx ? '16px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: i === stepIdx ? '#b48cff' : i < stepIdx ? 'rgba(180,140,255,0.4)' : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Current cue */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          <span style={{ color: '#b48cff', marginRight: '0.5rem', fontSize: '0.7rem', fontWeight: 600 }}>
            {step.id.toUpperCase()}
          </span>
          {step.cue}
        </div>
      </div>

      {/* Timer */}
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: totalElapsed > 210 ? '#ff6b6b' : 'rgba(255,255,255,0.6)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
      }}>
        {formatTime(totalElapsed)} / 3:30
      </div>

      {/* Next button */}
      <button
        onClick={advance}
        style={{
          background: 'rgba(180,140,255,0.15)',
          border: '1px solid rgba(180,140,255,0.3)',
          borderRadius: '6px',
          color: '#b48cff',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.25rem 0.6rem',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Next &rarr;
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '1rem',
          cursor: 'pointer',
          padding: '0 0.25rem',
          flexShrink: 0,
        }}
      >
        &times;
      </button>
    </div>,
    document.body,
  );
}
