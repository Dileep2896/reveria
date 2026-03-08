export default function DeleteConfirmDialog({ deleteTarget, deleting, onCancel, onConfirm }) {
  return (
    <div
      className="library-delete-overlay"
      onClick={() => !deleting && onCancel()}
    >
      <div
        className="library-delete-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="library-delete-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <h3 className="library-delete-title">Delete This Story?</h3>

        <div className="library-delete-divider" />

        <p className="library-delete-book-name">{deleteTarget.title}</p>
        <p className="library-delete-desc">
          This will permanently delete the story, all scenes, and generated media. This action cannot be undone.
        </p>

        <div className="library-delete-actions">
          <button
            className="library-delete-btn library-delete-btn--cancel"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="library-delete-btn library-delete-btn--confirm"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? '\u00A0' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
