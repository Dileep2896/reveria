import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db, doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs } from '../firebase';
import useBookDetails from '../hooks/useBookDetails';
import ReadingMode from './ReadingMode';
import IconBtn from './IconBtn';
import { API_URL } from '../utils/storyHelpers';
import './BookDetailsPage.css';

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

export default function BookDetailsPage({ user, setAppIsPublished, onOpenBook, onOpenPublicBook }) {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useAuth();
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

  // Social state — ratings
  const [ratingData, setRatingData] = useState({ avg: 0, count: 0, userRating: null, commentCount: 0 });
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Social state — comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Load story metadata (Firestore for auth'd users, public API for guests)
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function load() {
      setStoryLoading(true);
      try {
        if (!user) {
          // Guest — use public API (no auth required)
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
          // Auth'd user — read from Firestore directly
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
    const url = `${window.location.origin}/book/${storyId}`;
    navigator.clipboard.writeText(url)
      .then(() => addToast('Link copied!', 'success'))
      .catch(() => addToast('Failed to copy link', 'error'));
  }, [storyId, addToast]);

  // PDF
  const handlePdf = useCallback(async () => {
    addToast('Generating PDF...', 'info');
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/pdf`, {
        headers: { Authorization: `Bearer ${idToken}` },
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
  }, [storyId, idToken, addToast]);

  // Read This Story — load scenes and open Reading Mode
  const handleReadStory = useCallback(async () => {
    if (loadedScenes) {
      setReadingMode(true);
      return;
    }
    setLoadingScenes(true);
    try {
      let scenes;
      if (!user) {
        // Guest — load via public API
        const res = await fetch(`${API_URL}/api/public/stories/${storyId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        scenes = data.scenes || [];
      } else {
        // Auth'd — load from Firestore
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

  // Browse Story — load into WS state and navigate to /story/
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
      navigate('/');
      return;
    }
    if (location.state?.from === 'library') {
      navigate('/library');
    } else if (location.state?.from === 'explore') {
      navigate('/explore');
    } else if (isOwner) {
      navigate('/library');
    } else {
      navigate('/explore');
    }
  }, [navigate, location.state, isOwner, user]);

  // ── Social data: load ratings + comments ──
  useEffect(() => {
    if (!storyId || storyLoading) return;
    let cancelled = false;

    async function loadSocial() {
      const headers = {};
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      try {
        const res = await fetch(`${API_URL}/api/public/stories/${storyId}/social`, { headers });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setRatingData({
          avg: data.rating_avg || 0,
          count: data.rating_count || 0,
          userRating: data.user_rating || null,
          commentCount: data.comment_count || 0,
        });
      } catch { /* ignore */ }
    }

    async function loadComments() {
      setCommentsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/public/stories/${storyId}/comments`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setComments(data.comments || []);
      } catch { /* ignore */ }
      if (!cancelled) setCommentsLoading(false);
    }

    loadSocial();
    loadComments();
    return () => { cancelled = true; };
  }, [storyId, storyLoading, idToken]);

  // ── Like toggle (same pattern as ExplorePage) ──
  const handleToggleLike = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    const likedBy = storyData?.liked_by || [];
    const isLiked = likedBy.includes(uid);

    // Optimistic update
    setStoryData((prev) => {
      if (!prev) return prev;
      const newLikedBy = isLiked ? prev.liked_by.filter((id) => id !== uid) : [...prev.liked_by, uid];
      return { ...prev, liked_by: newLikedBy };
    });

    try {
      await updateDoc(doc(db, 'stories', storyId), {
        liked_by: isLiked ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch {
      // Rollback
      setStoryData((prev) => {
        if (!prev) return prev;
        const reverted = isLiked ? [...prev.liked_by, uid] : prev.liked_by.filter((id) => id !== uid);
        return { ...prev, liked_by: reverted };
      });
    }
  }, [user, storyId, storyData]);

  // ── Star rating ──
  const handleRate = useCallback(async (rating) => {
    if (!user || !idToken || ratingSubmitting) return;
    setRatingSubmitting(true);

    const oldData = { ...ratingData };
    // Optimistic update
    const wasNew = ratingData.userRating === null;
    const newCount = wasNew ? ratingData.count + 1 : ratingData.count;
    const newSum = wasNew
      ? (ratingData.avg * ratingData.count) + rating
      : (ratingData.avg * ratingData.count) - ratingData.userRating + rating;
    setRatingData({
      avg: newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0,
      count: newCount,
      userRating: rating,
      commentCount: ratingData.commentCount,
    });

    try {
      await fetch(`${API_URL}/api/stories/${storyId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ rating }),
      });
    } catch {
      setRatingData(oldData);
    } finally {
      setRatingSubmitting(false);
    }
  }, [user, idToken, storyId, ratingData, ratingSubmitting]);

  // ── Post comment ──
  const handlePostComment = useCallback(async () => {
    if (!user || !idToken || !commentText.trim() || postingComment) return;
    setPostingComment(true);
    const text = commentText.trim();
    setCommentText('');

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setComments((prev) => [data, ...prev]);
      setRatingData((prev) => ({ ...prev, commentCount: prev.commentCount + 1 }));
    } catch {
      setCommentText(text); // Restore on failure
      addToast('Failed to post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  }, [user, idToken, storyId, commentText, postingComment, addToast]);

  // ── Delete comment ──
  const handleDeleteComment = useCallback(async (commentId) => {
    if (!idToken) return;
    const prev = [...comments];
    setComments((c) => c.filter((x) => x.id !== commentId));
    setRatingData((r) => ({ ...r, commentCount: Math.max(0, r.commentCount - 1) }));

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setComments(prev);
      setRatingData((r) => ({ ...r, commentCount: r.commentCount + 1 }));
      addToast('Failed to delete comment', 'error');
    }
  }, [idToken, storyId, comments, addToast]);

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
        <button className="book-details-back" onClick={() => navigate('/explore')}>
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
          <button className="book-details-back" onClick={() => navigate('/')}>
            <BackArrow /> Sign in to create
          </button>
          <button className="book-details-back" onClick={() => navigate('/')}>
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
            {storyData.author_photo_url ? (
              <img className="book-details-avatar" src={storyData.author_photo_url} alt={storyData.author_name} referrerPolicy="no-referrer" />
            ) : (
              <div className="book-details-avatar book-details-avatar--fallback">
                {(storyData.author_name || '?')[0].toUpperCase()}
              </div>
            )}
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
        </div>
      </div>

      {/* Comments section — only for published stories */}
      {isPublished && (
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
                  {c.author_photo_url ? (
                    <img className="book-details-avatar" src={c.author_photo_url} alt={c.author_name} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="book-details-avatar book-details-avatar--fallback">
                      {(c.author_name || '?')[0].toUpperCase()}
                    </div>
                  )}
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

      {/* Reading Mode overlay — portal to body to escape overflow:hidden ancestors */}
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
