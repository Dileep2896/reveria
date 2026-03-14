import { useEffect, useRef } from 'react';
import UserAvatar from './UserAvatar';
import './BookDetailsPage.css';

const GENRE_TAGS = ['FANTASY', 'ADVENTURE'];
const THEME_TAGS = ['MYSTERY', 'TIME', 'ENVIRONMENTALISM'];
const MOOD = 'MYSTERIOUS';
const TARGET_AUDIENCE = 'Ages 8-12';

const SYNOPSIS =
  "Elara, a lonely lighthouse keeper, discovers a mysterious map leading to an impossible island where rivers defy gravity and time stands still. Guided by a talking fox, she uncovers the island's secrets and encounters Sable, who is more than he seems. Can Elara restore what's been lost before the island fades away completely?";

const HOOK_QUOTE =
  'It is a place where the world is mirrored, broken, and utterly strange.';

const CHARACTERS = [
  { name: 'Elara', role: 'Protagonist', description: 'A curious traveler who discovers a magical island.' },
  { name: 'Sable', role: 'Guardian', description: "A mysterious fox revealed to be the island's guardian." },
  { name: 'Fox', role: 'Guide', description: 'An enigmatic talking fox who guides Elara on her journey.' },
];

const CONTENT_WARNINGS = ['Mild peril'];

export default function DemoBookDetails({ autoScroll = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;

    const el = containerRef.current;
    // Reset to top
    el.scrollTop = 0;

    const duration = 1800;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    let start = null;
    let rafId;

    function step(timestamp) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      el.scrollTop = eased * maxScroll;
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    }

    const timeout = setTimeout(() => {
      rafId = requestAnimationFrame(step);
    }, 200);

    return () => {
      clearTimeout(timeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [autoScroll]);

  return (
    <div className="book-details-container" ref={containerRef}>
      <button className="book-details-back" style={{ pointerEvents: 'none' }}>
        <BackArrow /> Back to Explore
      </button>

      <div className="book-details-hero">
        {/* Cover */}
        <div className="book-details-cover-col">
          <img
            className="book-details-cover"
            src="/explore-covers/the-mirrored-island.png"
            alt="The Mirrored Island"
          />
        </div>

        {/* Info */}
        <div className="book-details-info">
          <div className="book-details-title-row">
            <h1 className="book-details-title">The Mirrored Island</h1>
            <button className="book-details-share-inline" style={{ pointerEvents: 'none' }}>
              <IconShare />
            </button>
          </div>

          <div className="book-details-author-row">
            <UserAvatar photoURL={null} name="Dileep Kumar" size={28} />
            <span className="book-details-author-name">Dileep Kumar</span>
          </div>

          {/* Tags */}
          <div className="book-details-tags">
            {GENRE_TAGS.map((g) => (
              <span key={`g-${g}`} className="book-details-tag book-details-tag--genre">{g}</span>
            ))}
            {THEME_TAGS.map((t) => (
              <span key={`t-${t}`} className="book-details-tag book-details-tag--theme">{t}</span>
            ))}
            <span className="book-details-tag book-details-tag--mood">{MOOD}</span>
            <span className="book-details-tag book-details-tag--audience">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {TARGET_AUDIENCE}
            </span>
          </div>

          {/* Stats */}
          <div className="book-details-stats">
            <div className="book-details-stat">
              <span className="book-details-stat-value">5</span>
              <span className="book-details-stat-label">Scenes</span>
            </div>
            <div className="book-details-stat">
              <span className="book-details-stat-value">2 min</span>
              <span className="book-details-stat-label">Read time</span>
            </div>
          </div>

          {/* Social stats row */}
          <div className="book-details-social">
            {/* Like */}
            <button className="book-details-social-item book-details-like-btn book-details-like-btn--liked" disabled style={{ pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>2</span>
            </button>

            {/* Star rating — 4 out of 5 filled */}
            <div className="book-details-social-item">
              <div className="book-details-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`book-details-star${star <= 4 ? ' book-details-star--filled' : ''}`} style={{ cursor: 'default' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={star <= 4 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                ))}
              </div>
              <span className="book-details-rating-text">4.0 (3 ratings)</span>
            </div>

            {/* Comment count */}
            <span className="book-details-social-item book-details-social-comments">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>2</span>
            </span>
          </div>

          {/* Synopsis */}
          <p className="book-details-synopsis">{SYNOPSIS}</p>

          {/* Hook quote */}
          <div className="book-details-hook">
            <span className="book-details-hook-mark">&ldquo;</span>
            <p>{HOOK_QUOTE}</p>
          </div>

          {/* Characters */}
          <h3 className="book-details-section-title">Characters</h3>
          <div className="book-details-characters">
            {CHARACTERS.map((c, i) => (
              <div key={i} className="book-details-character">
                <span className="book-details-character-name">{c.name}</span>
                <span className="book-details-character-role">{c.role}</span>
                <p className="book-details-character-desc">{c.description}</p>
              </div>
            ))}
          </div>

          {/* Content warnings */}
          <div className="book-details-warnings">
            {CONTENT_WARNINGS.map((w) => (
              <span key={w} className="book-details-warning">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {w}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="book-details-actions">
            <div className="book-details-actions-primary">
              <button className="book-details-btn book-details-btn--primary" style={{ pointerEvents: 'none' }}>
                Read This Story
              </button>
              <button className="book-details-btn book-details-btn--secondary" style={{ pointerEvents: 'none' }}>
                Browse Story
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="book-details-comments">
        <h3 className="book-details-section-title">Comments</h3>

        <div className="book-details-comment-form">
          <textarea
            className="book-details-comment-input"
            placeholder="Share your thoughts..."
            value=""
            readOnly
            rows={3}
            maxLength={2000}
          />
          <button
            className="book-details-btn book-details-btn--primary book-details-comment-submit"
            disabled
            style={{ pointerEvents: 'none' }}
          >
            Post Comment
          </button>
        </div>

        <div className="book-details-comment-list">
          <div className="book-details-comment">
            <div className="book-details-comment-header">
              <UserAvatar photoURL={null} name="Anika Patel" size={24} />
              <span className="book-details-comment-author">Anika Patel</span>
              <span className="book-details-comment-time">2 days ago</span>
            </div>
            <p className="book-details-comment-text">
              The imagery in this is stunning! The mirrored island concept reminds me of classic fantasy worlds but with a fresh twist. Loved Sable's reveal.
            </p>
          </div>
          <div className="book-details-comment">
            <div className="book-details-comment-header">
              <UserAvatar photoURL={null} name="Marcus Chen" size={24} />
              <span className="book-details-comment-author">Marcus Chen</span>
              <span className="book-details-comment-time">5 days ago</span>
            </div>
            <p className="book-details-comment-text">
              Really creative use of the gravity-defying rivers. My kids loved reading this one together!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
