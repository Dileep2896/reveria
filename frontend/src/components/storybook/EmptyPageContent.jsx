import { memo } from 'react';
import './EmptyPageContent.css';

const EmptyPageContent = memo(({ scale = 1, nextChapter = 2 }) => (
  <div className="empty-page" style={{ padding: `${24 * scale}px` }}>
    {/* Typewriter-style chapter hint */}
    <div className="empty-page-typewriter">
      <span
        className="empty-page-typed"
        style={{ fontSize: `${Math.max(11, 13 * scale)}px` }}
      >
        Scene {nextChapter} awaits&hellip;
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
));

export default EmptyPageContent;
