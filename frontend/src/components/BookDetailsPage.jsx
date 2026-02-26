import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db, doc, getDoc, updateDoc, collection, getDocs } from '../firebase';
import useBookDetails from '../hooks/useBookDetails';
import useBookSocial from '../hooks/useBookSocial';
import ReadingMode from './ReadingMode';
import BookSocialSection from './book/BookSocialSection';
import BookCommentSection from './book/BookCommentSection';
import BookActionBar from './book/BookActionBar';
import UserAvatar from './UserAvatar';
import { API_URL } from '../utils/storyHelpers';
import './BookDetailsPage.css';

const I = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);
const IconShare = () => <I d={<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>} />;

export default function BookDetailsPage({ user, setAppIsPublished, onOpenBook, onOpenPublicBook }) {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken, getValidToken } = useAuth();
  const { addToast } = useToast();
  const prepublish = location.state?.prepublish || false;

  const [storyData, setStoryData] = useState(null);
  const [storyLoading, setStoryLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const initRef = useRef(false);

  const {
    details, setDetails, generating, saving, editing,
    error, generateDetails, saveDetails,
    setEditing,
  } = useBookDetails({ storyId, idToken });

  // Editable draft state
  const [editDraft, setEditDraft] = useState(null);

  // Reading mode state
  const [readingMode, setReadingMode] = useState(false);
  const [loadedScenes, setLoadedScenes] = useState(null);
  const [loadingScenes, setLoadingScenes] = useState(false);

  const {
    ratingData, setRatingData, hoverRating, setHoverRating,
    comments, commentsLoading, commentText, setCommentText, postingComment,
    handleToggleLike, handleRate, handlePostComment, handleDeleteComment,
  } = useBookSocial({ storyId, storyLoading, idToken, getValidToken, user, storyData, setStoryData, addToast });

  // Load story metadata (Firestore for auth'd users, public API for guests)
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function load() {
      setStoryLoading(true);
      try {
        if (!user) {
          // Guest - use public API (no auth required)
          const res = await fetch(`${API_URL}/api/public/stories/${storyId}/details`);
          if (cancelled) return;
          if (!res.ok) { setStoryLoading(false); return; }
          const data = await res.json();
          const rAvg = data.rating_avg || 0;
          const rCount = data.rating_count || 0;
          setStoryData({
            title: data.title || 'Untitled',
            cover_image_url: data.cover_image_url,
            author_name: data.author_name || 'Anonymous',
            author_photo_url: data.author_photo_url,
            art_style: data.art_style || 'cinematic',
            language: data.language || 'English',
            total_scene_count: data.total_scene_count || 0,
            is_public: true,
            status: 'completed',
            uid: null,
            liked_by: [],
            like_count: data.like_count || 0,
            rating_avg: rAvg,
            rating_count: rCount,
            book_details: data.book_details || null,
            book_details_generated: true,
          });
          // Pre-populate rating + comment count so it renders instantly
          setRatingData((prev) => ({ ...prev, avg: rAvg, count: rCount, commentCount: data.comment_count || 0 }));
          setIsOwner(false);
          if (data.book_details) setDetails(data.book_details);
        } else {
          // Auth'd user - read from Firestore directly
          const storyRef = doc(db, 'stories', storyId);
          const snap = await getDoc(storyRef);
          if (cancelled) return;

          if (!snap.exists()) {
            setStoryLoading(false);
            return;
          }

          const data = snap.data();
          const rSum = data.rating_sum || 0;
          const rCnt = data.rating_count || 0;
          const rAvg = rCnt > 0 ? Math.round((rSum / rCnt) * 10) / 10 : 0;
          setStoryData({
            title: data.title || 'Untitled',
            cover_image_url: data.cover_image_url,
            author_name: data.author_name || 'Anonymous',
            author_photo_url: data.author_photo_url,
            art_style: data.art_style || 'cinematic',
            language: data.language || 'English',
            total_scene_count: data.total_scene_count || 0,
            is_public: data.is_public || false,
            status: data.status || 'draft',
            uid: data.uid,
            liked_by: data.liked_by || [],
            book_details: data.book_details || null,
            book_details_generated: data.book_details_generated || false,
          });
          // Pre-populate rating + comment count so it renders instantly
          setRatingData((prev) => ({ ...prev, avg: rAvg, count: rCnt, commentCount: data.comment_count || 0 }));

          const owner = data.uid === user.uid;
          setIsOwner(owner);

          if (data.book_details) setDetails(data.book_details);
        }
      } catch (err) {
        console.error('Failed to load story:', err);
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storyId, user, setDetails]);

  // Auto-generate on prepublish mode if not already generated
  useEffect(() => {
    if (initRef.current) return;
    if (storyLoading || !storyData) return;

    initRef.current = true;

    if (prepublish && isOwner && !storyData.book_details_generated) {
      generateDetails();
    }
  }, [storyLoading, storyData, prepublish, isOwner, generateDetails]);

  // Start editing
  const handleStartEdit = useCallback(() => {
    setEditDraft(details ? { ...details } : {});
    setEditing(true);
  }, [details, setEditing]);

  // Save edits
  const handleSaveEdits = useCallback(async () => {
    if (!editDraft) return;
    const ok = await saveDetails(editDraft);
    if (ok) {
      addToast('Details saved!', 'success');
      setEditDraft(null);
    } else {
      addToast('Failed to save details', 'error');
    }
  }, [editDraft, saveDetails, addToast]);

  // Cancel edits
  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditDraft(null);
  }, [setEditing]);

  // Publish
  const handlePublish = useCallback(async () => {
    if (!storyId || publishing) return;
    setPublishing(true);
    try {
      // Save any pending edits first
      if (editing && editDraft) {
        await saveDetails(editDraft);
        setEditDraft(null);
      }

      await updateDoc(doc(db, 'stories', storyId), {
        is_public: true,
        published_at: new Date(),
        author_name: user?.displayName || 'Anonymous',
        author_photo_url: user?.photoURL || null,
      });
      setStoryData((prev) => prev ? { ...prev, is_public: true } : prev);
      // Sync App-level published state so header updates immediately
      if (setAppIsPublished) setAppIsPublished(true);
      addToast('Story published to Explore!', 'success');
    } catch (err) {
      console.error('Failed to publish:', err);
      addToast('Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  }, [storyId, publishing, user, editing, editDraft, saveDetails, addToast]);

  // Unpublish (with confirmation)
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const handleUnpublish = useCallback(async () => {
    if (!storyId || unpublishing) return;
    setUnpublishing(true);
    try {
      await updateDoc(doc(db, 'stories', storyId), { is_public: false });
      setStoryData((prev) => prev ? { ...prev, is_public: false } : prev);
      if (setAppIsPublished) setAppIsPublished(false);
      setShowUnpublishConfirm(false);
      addToast('Story unpublished', 'success');
    } catch (err) {
      console.error('Failed to unpublish:', err);
      addToast('Failed to unpublish', 'error');
    } finally {
      setUnpublishing(false);
    }
  }, [storyId, unpublishing, addToast]);

  // Share
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${ROUTES.BOOK(storyId)}`;
    navigator.clipboard.writeText(url)
      .then(() => addToast('Link copied!', 'success'))
      .catch(() => addToast('Failed to copy link', 'error'));
  }, [storyId, addToast]);

  // PDF
  const handlePdf = useCallback(async () => {
    addToast('Generating PDF...', 'info');
    try {
      const token = getValidToken ? await getValidToken() : idToken;
      const res = await fetch(`${API_URL}/api/stories/${storyId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storyData?.title || 'story'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('PDF downloaded!', 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      addToast('PDF export failed', 'error');
    }
  }, [storyId, idToken, getValidToken, addToast]);

  // Read This Story - load scenes and open Reading Mode
  const handleReadStory = useCallback(async () => {
    if (loadedScenes) {
      setReadingMode(true);
      return;
    }
    setLoadingScenes(true);
    try {
      let scenes;
      if (!user) {
        // Guest - load via public API
        const res = await fetch(`${API_URL}/api/public/stories/${storyId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        scenes = data.scenes || [];
      } else {
        // Auth'd - load from Firestore
        const scenesSnap = await getDocs(collection(db, 'stories', storyId, 'scenes'));
        scenes = scenesSnap.docs
          .map((d) => d.data())
          .sort((a, b) => a.scene_number - b.scene_number);
      }
      if (scenes.length > 0) {
        setLoadedScenes(scenes);
        setReadingMode(true);
      } else {
        addToast('No scenes found', 'error');
      }
    } catch (err) {
      console.error('Failed to load scenes:', err);
      addToast('Failed to load story', 'error');
    } finally {
      setLoadingScenes(false);
    }
  }, [storyId, user, loadedScenes, addToast]);

  // Browse Story - load into WS state and navigate to /story/
  const [browsingStory, setBrowsingStory] = useState(false);
  const handleBrowseStory = useCallback(async () => {
    if (browsingStory) return;
    setBrowsingStory(true);
    try {
      const scenesSnap = await getDocs(collection(db, 'stories', storyId, 'scenes'));
      const scenes = scenesSnap.docs
        .map((d) => d.data())
        .sort((a, b) => a.scene_number - b.scene_number);

      const gensSnap = await getDocs(collection(db, 'stories', storyId, 'generations'));
      const generations = gensSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            prompt: data.prompt,
            directorData: data.director_data || null,
            sceneNumbers: data.scene_numbers || [],
          };
        })
        .sort((a, b) => (a.sceneNumbers[0] ?? 0) - (b.sceneNumbers[0] ?? 0));

      const bookData = {
        storyId,
        scenes,
        generations,
        status: storyData?.status || 'completed',
        is_public: storyData?.is_public || false,
        art_style: storyData?.art_style || 'cinematic',
        language: storyData?.language || 'English',
        authorUid: storyData?.uid,
      };

      if (isOwner) {
        onOpenBook(bookData);
      } else {
        onOpenPublicBook(bookData);
      }
    } catch (err) {
      console.error('Failed to browse story:', err);
      addToast('Failed to open story', 'error');
    } finally {
      setBrowsingStory(false);
    }
  }, [storyId, storyData, isOwner, browsingStory, onOpenBook, onOpenPublicBook, addToast]);

  // Navigate back
  const handleBack = useCallback(() => {
    if (!user) {
      navigate(ROUTES.HOME);
      return;
    }
    if (location.state?.from === 'library') {
      navigate(ROUTES.LIBRARY);
    } else if (location.state?.from === 'explore') {
      navigate(ROUTES.EXPLORE);
    } else if (isOwner) {
      navigate(ROUTES.LIBRARY);
    } else {
      navigate(ROUTES.EXPLORE);
    }
  }, [navigate, location.state, isOwner, user]);

  // ── Loading / Error states ──
  if (storyLoading) {
    return (
      <div className="book-details-container">
        {/* Back button skeleton */}
        <div className="book-details-skeleton-back" />

        <div className="book-details-skeleton">
          {/* Cover */}
          <div className="book-details-skeleton-cover" />

          {/* Info column */}
          <div className="book-details-skeleton-info">
            {/* Title */}
            <div className="book-details-skeleton-line book-details-skeleton-line--title" />
            {/* Author row */}
            <div className="book-details-skeleton-author">
              <div className="book-details-skeleton-avatar" />
              <div className="book-details-skeleton-line" style={{ width: '120px', height: '0.75rem' }} />
            </div>
            {/* Tags */}
            <div className="book-details-skeleton-tags">
              <div className="book-details-skeleton-pill" />
              <div className="book-details-skeleton-pill book-details-skeleton-pill--wide" />
              <div className="book-details-skeleton-pill" />
              <div className="book-details-skeleton-pill book-details-skeleton-pill--wide" />
            </div>
            {/* Stats */}
            <div className="book-details-skeleton-stats">
              <div className="book-details-skeleton-stat-block" />
              <div className="book-details-skeleton-stat-block" />
            </div>
            {/* Social row */}
            <div className="book-details-skeleton-social">
              <div className="book-details-skeleton-pill" style={{ width: '50px' }} />
              <div className="book-details-skeleton-pill" style={{ width: '100px' }} />
              <div className="book-details-skeleton-pill" style={{ width: '40px' }} />
            </div>
            {/* Synopsis */}
            <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
            <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
            <div className="book-details-skeleton-line" style={{ width: '65%' }} />
            <div className="book-details-skeleton-line" style={{ width: '45%' }} />
            {/* Action buttons */}
            <div className="book-details-skeleton-actions">
              <div className="book-details-skeleton-btn" />
              <div className="book-details-skeleton-btn book-details-skeleton-btn--secondary" />
            </div>
          </div>
        </div>

        {/* Comments skeleton */}
        <div className="book-details-skeleton-comments">
          <div className="book-details-skeleton-line" style={{ width: '100px', height: '1.1rem', marginBottom: '1rem' }} />
          <div className="book-details-skeleton-comment-card">
            <div className="book-details-skeleton-author">
              <div className="book-details-skeleton-avatar" />
              <div className="book-details-skeleton-line" style={{ width: '90px', height: '0.7rem' }} />
            </div>
            <div className="book-details-skeleton-line book-details-skeleton-line--medium" style={{ marginTop: '0.5rem' }} />
            <div className="book-details-skeleton-line" style={{ width: '55%' }} />
          </div>
          <div className="book-details-skeleton-comment-card">
            <div className="book-details-skeleton-author">
              <div className="book-details-skeleton-avatar" />
              <div className="book-details-skeleton-line" style={{ width: '110px', height: '0.7rem' }} />
            </div>
            <div className="book-details-skeleton-line" style={{ width: '70%', marginTop: '0.5rem' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!storyData) {
    return (
      <div className="book-details-container">
        <button className="book-details-back" onClick={() => navigate(ROUTES.EXPLORE)}>
          <BackArrow /> Back to Explore
        </button>
        <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>
          <p>Story not found.</p>
        </div>
      </div>
    );
  }

  // Determine mode
  const isPublished = storyData.is_public;
  const isPrepublish = prepublish && isOwner && !isPublished;
  const isAuthorView = isOwner && isPublished;
  const isVisitorView = !isOwner;

  const d = editing ? editDraft : details;

  return (
    <div className="book-details-container">
      {user ? (
        <button className="book-details-back" onClick={handleBack}>
          <BackArrow />
          {isVisitorView ? 'Back to Explore' : 'Back to Library'}
        </button>
      ) : (
        <div className="book-details-guest-cta">
          <button className="book-details-back" onClick={() => navigate(ROUTES.HOME)}>
            <BackArrow /> Sign in to create
          </button>
          <button className="book-details-back" onClick={() => navigate(ROUTES.HOME)}>
            Explore more stories
          </button>
        </div>
      )}

      <div className="book-details-hero">
        {/* Cover */}
        <div className="book-details-cover-col">
          {storyData.cover_image_url ? (
            <img className="book-details-cover" src={storyData.cover_image_url} alt={storyData.title} />
          ) : (
            <div className="book-details-cover-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="book-details-info">
          <div className="book-details-title-row">
            <h1 className="book-details-title">{storyData.title}</h1>
            {isVisitorView && (
              <button className="book-details-share-inline" onClick={handleShare} title="Share">
                <IconShare />
              </button>
            )}
          </div>

          <div className="book-details-author-row">
            <UserAvatar photoURL={storyData.author_photo_url} name={storyData.author_name || '?'} size={28} />
            <span className="book-details-author-name">{storyData.author_name}</span>
          </div>

          {/* Generating state */}
          {generating && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="book-details-skeleton-lines">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  Generating book details...
                </p>
                <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
                <div className="book-details-skeleton-line book-details-skeleton-line--medium" />
                <div className="book-details-skeleton-line book-details-skeleton-line--short" />
              </div>
            </div>
          )}

          {/* Details content */}
          {d && !generating && (
            <>
              {/* Genre + theme + mood + audience tags */}
              <div className="book-details-tags">
                {(d.genre_tags || []).map((g) => (
                  <span key={`g-${g}`} className="book-details-tag book-details-tag--genre">{g}</span>
                ))}
                {(d.themes || []).map((t) => (
                  <span key={`t-${t}`} className="book-details-tag book-details-tag--theme">{t}</span>
                ))}
                {d.mood && (
                  <span className="book-details-tag book-details-tag--mood">{d.mood}</span>
                )}
                {d.target_audience && (
                  <span className="book-details-tag book-details-tag--audience">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {d.target_audience}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="book-details-stats">
                <div className="book-details-stat">
                  <span className="book-details-stat-value">{storyData.total_scene_count}</span>
                  <span className="book-details-stat-label">Scenes</span>
                </div>
                {d.reading_time_minutes && (
                  <div className="book-details-stat">
                    <span className="book-details-stat-value">{d.reading_time_minutes} min</span>
                    <span className="book-details-stat-label">Read time</span>
                  </div>
                )}
              </div>

              {/* Social stats row */}
              {isPublished && (
                <BookSocialSection
                  user={user}
                  storyData={storyData}
                  ratingData={ratingData}
                  hoverRating={hoverRating}
                  setHoverRating={setHoverRating}
                  handleToggleLike={handleToggleLike}
                  handleRate={handleRate}
                />
              )}

              {/* Synopsis */}
              {editing ? (
                <div className="book-details-edit-field">
                  <div className="book-details-edit-label">Synopsis</div>
                  <textarea
                    className="book-details-synopsis-edit"
                    value={editDraft?.synopsis || ''}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, synopsis: e.target.value }))}
                    rows={4}
                  />
                </div>
              ) : (
                d.synopsis && <p className="book-details-synopsis">{d.synopsis}</p>
              )}

              {/* Hook quote */}
              {!editing && d.hook_quote && (
                <div className="book-details-hook">
                  <span className="book-details-hook-mark">"</span>
                  <p>{d.hook_quote}</p>
                </div>
              )}

              {/* Editing: mood + target audience */}
              {editing && (
                <>
                  <div className="book-details-edit-field">
                    <div className="book-details-edit-label">Mood</div>
                    <input
                      className="book-details-edit-input"
                      value={editDraft?.mood || ''}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, mood: e.target.value }))}
                    />
                  </div>
                  <div className="book-details-edit-field">
                    <div className="book-details-edit-label">Target Audience</div>
                    <input
                      className="book-details-edit-input"
                      value={editDraft?.target_audience || ''}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, target_audience: e.target.value }))}
                    />
                  </div>
                  <div className="book-details-edit-field">
                    <div className="book-details-edit-label">Hook Quote</div>
                    <input
                      className="book-details-edit-input"
                      value={editDraft?.hook_quote || ''}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, hook_quote: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Characters */}
              {(d.character_list || []).length > 0 && (
                <>
                  <h3 className="book-details-section-title">Characters</h3>
                  <div className="book-details-characters">
                    {d.character_list.map((c, i) => (
                      <div key={i} className="book-details-character">
                        <span className="book-details-character-name">{c.name}</span>
                        {c.role && <span className="book-details-character-role">{c.role}</span>}
                        {c.description && <p className="book-details-character-desc">{c.description}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Content warnings */}
              {(d.content_warnings || []).length > 0 && (
                <div className="book-details-warnings">
                  {d.content_warnings.map((w) => (
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
              )}
            </>
          )}

          {/* Error */}
          {error && !generating && (
            <p style={{ color: 'var(--status-error)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>
          )}

          {/* ── Actions ── */}
          <BookActionBar
            editing={editing}
            saving={saving}
            handleSaveEdits={handleSaveEdits}
            handleCancelEdit={handleCancelEdit}
            isPrepublish={isPrepublish}
            isAuthorView={isAuthorView}
            isOwner={isOwner}
            isPublished={isPublished}
            isVisitorView={isVisitorView}
            details={details}
            generating={generating}
            publishing={publishing}
            handlePublish={handlePublish}
            handleReadStory={handleReadStory}
            loadingScenes={loadingScenes}
            handleBrowseStory={handleBrowseStory}
            browsingStory={browsingStory}
            handleStartEdit={handleStartEdit}
            handleShare={handleShare}
            handlePdf={handlePdf}
            setShowUnpublishConfirm={setShowUnpublishConfirm}
            user={user}
            storyData={storyData}
          />
        </div>
      </div>

      {/* Comments section - only for published stories */}
      {isPublished && (
        <BookCommentSection
          user={user}
          storyData={storyData}
          comments={comments}
          commentsLoading={commentsLoading}
          commentText={commentText}
          setCommentText={setCommentText}
          postingComment={postingComment}
          handlePostComment={handlePostComment}
          handleDeleteComment={handleDeleteComment}
        />
      )}

      {/* Unpublish confirmation */}
      {showUnpublishConfirm && (
        <div className="book-details-overlay" onClick={() => !unpublishing && setShowUnpublishConfirm(false)} onKeyDown={(e) => e.key === 'Escape' && !unpublishing && setShowUnpublishConfirm(false)} tabIndex={-1} ref={(el) => el?.focus()}>
          <div className="book-details-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="book-details-confirm-title">Unpublish this story?</p>
            <p className="book-details-confirm-desc">It will be removed from Explore. You can republish anytime.</p>
            <div className="book-details-confirm-actions">
              <button className="book-details-btn book-details-btn--secondary" onClick={() => setShowUnpublishConfirm(false)} disabled={unpublishing}>Cancel</button>
              <button className="book-details-btn book-details-btn--danger" onClick={handleUnpublish} disabled={unpublishing}>{unpublishing ? 'Unpublishing...' : 'Unpublish'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reading Mode overlay - portal to body to escape overflow:hidden ancestors */}
      {readingMode && loadedScenes && loadedScenes.length > 0 && createPortal(
        <ReadingMode
          scenes={loadedScenes}
          storyId={storyId}
          idToken={idToken}
          onExit={() => setReadingMode(false)}
        />,
        document.body,
      )}
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
