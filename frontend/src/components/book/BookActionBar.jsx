import IconBtn from '../IconBtn';

const I = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);
const IconRead = () => <I d={<><polygon points="5 3 19 12 5 21 5 3" /></>} />;
const IconBrowse = () => <I d={<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>} />;
const IconEdit = () => <I d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />;
const IconShare = () => <I d={<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>} />;
const IconPdf = () => <I d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>} />;
const IconUnpublish = () => <I d={<><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>} />;

export default function BookActionBar({
  editing, saving, handleSaveEdits, handleCancelEdit,
  isPrepublish, isAuthorView, isOwner, isPublished, isVisitorView,
  details, generating, publishing, handlePublish,
  handleReadStory, loadingScenes,
  handleBrowseStory, browsingStory,
  handleStartEdit, handleShare, handlePdf,
  setShowUnpublishConfirm,
  user, storyData,
}) {
  return (
    <div className="book-details-actions">
      {/* Editing actions */}
      {editing && (
        <div className="book-details-actions-primary">
          <button className="book-details-btn book-details-btn--primary" onClick={handleSaveEdits} disabled={saving}>
            {saving ? 'Saving...' : 'Save Edits'}
          </button>
          <button className="book-details-btn book-details-btn--secondary" onClick={handleCancelEdit}>
            Cancel
          </button>
        </div>
      )}

      {/* Non-editing actions */}
      {!editing && (
        <>
          {/* Pre-publish */}
          {isPrepublish && details && !generating && (
            <>
              <div className="book-details-actions-primary">
                <button className="book-details-btn book-details-btn--primary" onClick={handlePublish} disabled={publishing}>
                  {publishing ? 'Publishing...' : 'Publish to Explore'}
                </button>
              </div>
              <div className="book-details-actions-secondary">
                <IconBtn label="Edit" size={36} onClick={handleStartEdit}><IconEdit /></IconBtn>
              </div>
            </>
          )}

          {/* Author view: published */}
          {isAuthorView && details && (
            <>
              <div className="book-details-actions-primary">
                <button className="book-details-btn book-details-btn--primary" onClick={handleReadStory} disabled={loadingScenes}>
                  <IconRead /> {loadingScenes ? 'Loading...' : 'Read Story'}
                </button>
                <button className="book-details-btn book-details-btn--secondary" onClick={handleBrowseStory} disabled={browsingStory}>
                  <IconBrowse /> {browsingStory ? 'Loading...' : 'Browse Story'}
                </button>
              </div>
              <div className="book-details-actions-secondary">
                <IconBtn label="Edit" size={36} onClick={handleStartEdit}><IconEdit /></IconBtn>
                <IconBtn label="Share" size={36} onClick={handleShare}><IconShare /></IconBtn>
                <IconBtn label="PDF" size={36} onClick={handlePdf}><IconPdf /></IconBtn>
                <IconBtn label="Unpublish" size={36} danger onClick={() => setShowUnpublishConfirm(true)}><IconUnpublish /></IconBtn>
              </div>
            </>
          )}

          {/* Owner, completed but not published */}
          {isOwner && !isPublished && !isPrepublish && storyData.status === 'completed' && details && !generating && (
            <>
              <div className="book-details-actions-primary">
                <button className="book-details-btn book-details-btn--primary" onClick={handlePublish} disabled={publishing}>
                  {publishing ? 'Publishing...' : 'Publish to Explore'}
                </button>
                <button className="book-details-btn book-details-btn--secondary" onClick={handleReadStory} disabled={loadingScenes}>
                  <IconRead /> {loadingScenes ? 'Loading...' : 'Read Story'}
                </button>
                <button className="book-details-btn book-details-btn--secondary" onClick={handleBrowseStory} disabled={browsingStory}>
                  <IconBrowse /> {browsingStory ? 'Loading...' : 'Browse Story'}
                </button>
              </div>
              <div className="book-details-actions-secondary">
                <IconBtn label="Edit" size={36} onClick={handleStartEdit}><IconEdit /></IconBtn>
              </div>
            </>
          )}

          {/* Visitor view */}
          {isVisitorView && (
            <div className="book-details-actions-primary">
              <button className="book-details-btn book-details-btn--primary" onClick={handleReadStory} disabled={loadingScenes}>
                <IconRead /> {loadingScenes ? 'Loading...' : 'Read This Story'}
              </button>
              {user && (
                <button className="book-details-btn book-details-btn--secondary" onClick={handleBrowseStory} disabled={browsingStory}>
                  <IconBrowse /> {browsingStory ? 'Loading...' : 'Browse Story'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
