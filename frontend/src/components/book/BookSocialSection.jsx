export default function BookSocialSection({ user, storyData, ratingData, hoverRating, setHoverRating, handleToggleLike, handleRate }) {
  return (
    <div className="book-details-social">
      {/* Like */}
      <button
        className={`book-details-social-item book-details-like-btn${user && (storyData.liked_by || []).includes(user.uid) ? ' book-details-like-btn--active' : ''}`}
        onClick={handleToggleLike}
        disabled={!user}
        title={user ? 'Like this story' : 'Sign in to like'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={user && (storyData.liked_by || []).includes(user.uid) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span>{(storyData.liked_by || []).length || storyData.like_count || 0}</span>
      </button>

      {/* Star rating */}
      <div className="book-details-social-item">
        <div className="book-details-stars" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = hoverRating ? star <= hoverRating : star <= Math.round(ratingData.avg);
            const isUserRating = !hoverRating && ratingData.userRating && star <= ratingData.userRating;
            return (
              <span
                key={star}
                className={`book-details-star${filled ? ' book-details-star--filled' : ''}${hoverRating && star <= hoverRating ? ' book-details-star--hover' : ''}${isUserRating ? ' book-details-star--user' : ''}`}
                onClick={() => user && handleRate(star)}
                onMouseEnter={() => user && setHoverRating(star)}
                role={user ? 'button' : undefined}
                style={{ cursor: user ? 'pointer' : 'default' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
            );
          })}
        </div>
        <span className="book-details-rating-text">
          {ratingData.count > 0 ? `${ratingData.avg} (${ratingData.count})` : 'No ratings'}
        </span>
      </div>

      {/* Comment count */}
      <span className="book-details-social-item book-details-social-comments">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{ratingData.commentCount}</span>
      </span>
    </div>
  );
}
