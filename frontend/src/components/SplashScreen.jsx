import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import './SplashScreen.css';

const MICROCOPY_PHRASES = [
  'Waking the Narrator...',
  'Consulting the Director...',
  'Extracting visual DNA...',
  'Painting the scenes...',
  'Mixing the color palette...',
  'Tuning the story arc...',
  'Summoning characters...',
  'Preparing the inkwell...',
  'Weaving plot threads...',
  'Polishing the prose...',
  'Setting the stage...',
  'Lighting the lanterns...',
  'Binding the pages...',
  'Dreaming up worlds...',
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SplashScreen({ message, exiting }) {
  const shuffledRef = useRef(null);
  if (!shuffledRef.current) shuffledRef.current = shuffleArray(MICROCOPY_PHRASES);

  const [phraseIndex, setPhraseIndex] = useState(0);
  const isConnecting = message === 'Connecting...';

  useEffect(() => {
    if (isConnecting || exiting) return;
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % shuffledRef.current.length);
    }, 1500);
    return () => clearInterval(id);
  }, [isConnecting, exiting]);

  const phrase = shuffledRef.current[phraseIndex];

  return (
    <div className={`splash-root${exiting ? ' splash-exiting' : ''}`}>
      {/* Background */}
      <div className="splash-bg">
        <div className="orb" style={{ background: 'var(--orb-1)' }} />
        <div className="orb" style={{ background: 'var(--orb-2)' }} />
        <div className="orb" style={{ background: 'var(--orb-3)' }} />
      </div>

      {/* Enhancement 4: Ambient glow */}
      <div className="splash-ambient-glow" />

      {/* Content */}
      <div className="splash-content">
        {/* Enhancement 2: Breathing logo */}
        <div className="splash-logo-wrap">
          <Logo size="full" />
        </div>

        {/* Enhancement 3: Elevated progress bar */}
        <div className="splash-progress-track">
          <div className="splash-progress-comet" />
          <div className="splash-progress-shimmer" />
        </div>

        {/* Enhancement 1: Message + dynamic microcopy */}
        <p className="splash-message">{message}</p>
        {!isConnecting && (
          <p className="splash-microcopy" key={phrase}>
            {phrase}
          </p>
        )}
      </div>
    </div>
  );
}
