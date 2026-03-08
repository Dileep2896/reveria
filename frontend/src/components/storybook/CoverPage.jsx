import { forwardRef } from 'react';
import { BookCover } from '../TemplateChooser';

const CoverPage = forwardRef(function CoverPage({ generating, template, bookSize }, ref) {
  return (
    <div ref={ref} className="book-page-cover-host">
      <BookCover templateKey={template || 'storybook'} size={bookSize} standalone selected />
      {generating && <div className="book-cover-shimmer" />}
    </div>
  );
});

export default CoverPage;
