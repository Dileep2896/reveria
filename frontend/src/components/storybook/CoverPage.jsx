import { forwardRef } from 'react';
import { getLangData } from '../../data/languages';

const CoverPage = forwardRef(function CoverPage({ lang, generating }, ref) {
  const l = lang || getLangData('English');

  return (
    <div ref={ref} className="book-page book-page-cover">
      <div className="book-cover-inner-frame" />
      <div className="book-cover-content">
        <div className={`book-cover-icon${generating ? ' book-cover-icon--generating' : ''}`}>
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
      </div>
      {generating && <div className="book-cover-shimmer" />}
    </div>
  );
});

export default CoverPage;
