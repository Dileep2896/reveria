import { useTheme } from '../contexts/ThemeContext';
import './Logo.css';

export default function Logo({ size = 'compact' }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const iconPx = size === 'compact' ? 32 : 52;
  const wordmarkPx = size === 'compact' ? 26 : 42;

  const orbGrad = isLight ? 'orbGradL' : 'orbGrad';
  const orbGrad2 = isLight ? 'orbGrad2L' : 'orbGrad2';
  const bookGrad = isLight ? 'bookGradL' : 'bookGrad';
  const ringGrad = isLight ? 'ringGradL' : 'ringGrad';

  const sparkColors = isLight
    ? { s1: '#d4842a', s2: '#8b5fbf', s3: '#2bab82', s4: '#d45a7a', t1: '#8b5fbf', t2: '#d4842a' }
    : { s1: '#ffa86c', s2: '#b48cff', s3: '#6ce8c0', s4: '#ff7eb3', t1: '#fff', t2: '#fff' };

  return (
    <div className={`rv-logo rv-logo-${size}`}>
      <div className="rv-icon" style={{ width: iconPx, height: iconPx }}>
        <svg viewBox="0 0 52 52" fill="none" width={iconPx} height={iconPx}>
          <defs>
            <linearGradient id="ringGrad" x1="4" y1="4" x2="48" y2="48">
              <stop offset="0%" stopColor="#b48cff"/>
              <stop offset="100%" stopColor="#ff7eb3"/>
            </linearGradient>
            <radialGradient id="orbGrad" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#d4bdff"/>
              <stop offset="60%" stopColor="#b48cff"/>
              <stop offset="100%" stopColor="#7c4dff" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="orbGrad2" cx="40%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#ffa86c"/>
              <stop offset="100%" stopColor="#ffa86c" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="bookGrad" x1="16" y1="28" x2="36" y2="20">
              <stop offset="0%" stopColor="#e8deff"/>
              <stop offset="100%" stopColor="#ffd4b8"/>
            </linearGradient>
            <linearGradient id="ringGradL" x1="4" y1="4" x2="48" y2="48">
              <stop offset="0%" stopColor="#8b5fbf"/>
              <stop offset="100%" stopColor="#d45a7a"/>
            </linearGradient>
            <radialGradient id="orbGradL" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#c4a8e8"/>
              <stop offset="60%" stopColor="#8b5fbf"/>
              <stop offset="100%" stopColor="#5a2d8a" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="orbGrad2L" cx="40%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#d4842a"/>
              <stop offset="100%" stopColor="#d4842a" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="bookGradL" x1="16" y1="28" x2="36" y2="20">
              <stop offset="0%" stopColor="#6b3fa0"/>
              <stop offset="100%" stopColor="#c76b3a"/>
            </linearGradient>
          </defs>
          <circle cx="26" cy="26" r="22" stroke={`url(#${ringGrad})`} strokeWidth="1.2" opacity={isLight ? 0.25 : 0.3}/>
          <circle cx="26" cy="26" r="12" fill={`url(#${orbGrad})`} className="rv-dream-orb" opacity={isLight ? 0.85 : 0.9}/>
          <circle cx="26" cy="26" r="12" fill={`url(#${orbGrad2})`} className="rv-dream-orb" opacity={isLight ? 0.3 : 0.4}/>
          <path d="M16 28 C16 24, 20 20, 26 19 C32 20, 36 24, 36 28" stroke={`url(#${bookGrad})`} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={isLight ? 0.7 : 0.8}/>
          <line x1="26" y1="19" x2="26" y2="29" stroke={`url(#${bookGrad})`} strokeWidth="1" opacity={isLight ? 0.4 : 0.5}/>
          <circle cx="18" cy="14" r="1.8" fill={sparkColors.s1} className="rv-spark-1"/>
          <circle cx="34" cy="12" r="2" fill={sparkColors.s2} className="rv-spark-2"/>
          <circle cx="38" cy="20" r="1.5" fill={sparkColors.s3} className="rv-spark-3"/>
          <circle cx="14" cy="22" r="1.3" fill={sparkColors.s4} className="rv-spark-4"/>
          {size !== 'compact' && (
            <>
              <circle cx="22" cy="10" r="0.7" fill={sparkColors.t1} opacity={isLight ? 0.4 : 0.5} className="rv-spark-3"/>
              <circle cx="32" cy="18" r="0.6" fill={sparkColors.t2} opacity={isLight ? 0.3 : 0.4} className="rv-spark-1"/>
            </>
          )}
        </svg>
      </div>
      <div className="rv-text">
        <span className="rv-wordmark" style={{ fontSize: wordmarkPx }}>Reveria</span>
        {size === 'full' && (
          <span className="rv-tagline">Stories from your imagination</span>
        )}
      </div>
    </div>
  );
}
