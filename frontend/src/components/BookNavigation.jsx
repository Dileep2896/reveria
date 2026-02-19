export default function BookNavigation({
  currentPage,
  totalPages,
  minPage = 0,
  onPrev,
  onNext,
  onGoTo,
  disabled,
}) {
  return (
    <div className="book-nav">
      <button
        className="book-nav-arrow"
        onClick={onPrev}
        disabled={disabled || currentPage <= minPage}
        aria-label="Previous page"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="book-nav-dots">
        {Array.from({ length: totalPages }, (_, i) => (
          i < minPage ? null : (
            <button
              key={i}
              className={`book-nav-dot${i === currentPage ? ' active' : ''}`}
              onClick={() => !disabled && onGoTo(i)}
              aria-label={`Go to page ${i + 1}`}
            />
          )
        ))}
      </div>

      <button
        className="book-nav-arrow"
        onClick={onNext}
        disabled={disabled || currentPage >= totalPages - 1}
        aria-label="Next page"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
