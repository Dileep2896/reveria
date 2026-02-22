import { forwardRef } from 'react';
import { GENRE_KEYS, getLangData } from '../../data/languages';

const CoverPage = forwardRef(function CoverPage({ onGenreClick, lang }, ref) {
  const l = lang || getLangData('English');
  return (
    <div ref={ref} className="book-page book-page-cover">
      <div className="book-cover-inner-frame" />
      <div className="book-cover-content">
        <div className="book-cover-icon">
          <svg
            width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent-primary)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <h2 className="book-cover-title">{l.title}</h2>
        <div className="book-cover-ornament" />
        <p className="book-cover-subtitle">{l.subtitle}</p>
        <div className="book-cover-genres">
          {GENRE_KEYS.map((g) => (
            <button
              key={g}
              className="book-cover-genre"
              onClick={() => onGenreClick?.(l.genres[g].prompt)}
            >
              {l.genres[g].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default CoverPage;
