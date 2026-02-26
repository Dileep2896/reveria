import UserAvatar from '../UserAvatar';

export default function BookCommentSection({ user, storyData, comments, commentsLoading, commentText, setCommentText, postingComment, handlePostComment, handleDeleteComment }) {
  return (
    <div className="book-details-comments">
      <h3 className="book-details-section-title">Comments</h3>

      {/* Comment form (logged-in only) */}
      {user && (
        <div className="book-details-comment-form">
          <textarea
            className="book-details-comment-input"
            placeholder="Share your thoughts..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <button
            className="book-details-btn book-details-btn--primary book-details-comment-submit"
            onClick={handlePostComment}
            disabled={postingComment || !commentText.trim()}
          >
            {postingComment ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      )}

      {/* Comment list */}
      {commentsLoading ? (
        <div className="book-details-skeleton-lines" style={{ maxWidth: 500 }}>
          <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
          <div className="book-details-skeleton-line book-details-skeleton-line--short" />
          <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
        </div>
      ) : comments.length === 0 ? (
        <p className="book-details-comments-empty">No comments yet. Be the first to share your thoughts!</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="book-details-comment">
            <div className="book-details-comment-header">
              <UserAvatar photoURL={c.author_photo_url} name={c.author_name || '?'} size={28} />
              <span className="book-details-comment-author">{c.author_name || 'Anonymous'}</span>
              <span className="book-details-comment-time">
                {c.created_at ? new Date(c.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </span>
              {user && (c.uid === user.uid || (storyData?.uid && storyData.uid === user.uid)) && (
                <button
                  className="book-details-comment-delete"
                  onClick={() => handleDeleteComment(c.id)}
                  title="Delete comment"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
            <p className="book-details-comment-text">{c.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
