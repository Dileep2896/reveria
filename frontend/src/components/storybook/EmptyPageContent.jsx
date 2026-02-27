import { memo } from 'react';
import './EmptyPageContent.css';

const EmptyPageContent = memo(({ scale = 1 }) => (
  <div className="empty-page" style={{ padding: `${24 * scale}px` }}>
    {/* Static edge vignette (darkens corners) */}
    <div className="empty-page-vignette-edge" />
    {/* Breathing center glow */}
    <div className="empty-page-vignette" />

    {/* StoryForge watermark */}
    <div className="empty-page-watermark">
      <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Open book */}
        <path d="M30 45 Q60 35 60 75 Q30 65 30 45Z" fill="currentColor" opacity="0.5" />
        <path d="M90 45 Q60 35 60 75 Q90 65 90 45Z" fill="currentColor" opacity="0.4" />
        <line x1="60" y1="38" x2="60" y2="75" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        {/* Forge sparks */}
        <circle cx="50" cy="32" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="70" cy="30" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="58" cy="26" r="1.8" fill="currentColor" opacity="0.45" />
        <circle cx="65" cy="34" r="1.2" fill="currentColor" opacity="0.35" />
        <circle cx="45" cy="28" r="1" fill="currentColor" opacity="0.3" />
      </svg>
    </div>

    {/* Glassmorphic card */}
    <div className="empty-page-card" style={{ padding: `${20 * scale}px ${28 * scale}px` }}>
      {/* + icon */}
      <div
        className="empty-page-icon"
        style={{
          width: `${44 * scale}px`,
          height: `${44 * scale}px`,
          marginBottom: `${14 * scale}px`,
        }}
      >
        <svg
          width={18 * scale} height={18 * scale} viewBox="0 0 24 24" fill="none"
          stroke="var(--accent-primary)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </div>

      {/* Literary text */}
      <p
        className="empty-page-title"
        style={{
          fontSize: `${14 * scale}px`,
          marginBottom: `${10 * scale}px`,
        }}
      >
        The story continues&hellip;
      </p>

      {/* Ornamental flourish */}
      <div className="empty-page-flourish" style={{ marginBottom: `${10 * scale}px` }}>
        <span className="empty-page-flourish-dot">✦</span>
        <span className="empty-page-flourish-line" />
        <span className="empty-page-flourish-diamond">❖</span>
        <span className="empty-page-flourish-line" />
        <span className="empty-page-flourish-dot">✦</span>
      </div>

      {/* Subtitle */}
      <p
        className="empty-page-subtitle"
        style={{
          fontSize: `${9 * scale}px`,
          maxWidth: `${200 * scale}px`,
        }}
      >
        Type a prompt to add more scenes to your story
      </p>
    </div>
  </div>
));

export default EmptyPageContent;
