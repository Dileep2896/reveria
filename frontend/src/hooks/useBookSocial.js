import { useState, useEffect, useCallback } from 'react';
import { db, doc, updateDoc, arrayUnion, arrayRemove } from '../firebase';
import { API_URL } from '../utils/storyHelpers';

export default function useBookSocial({ storyId, storyLoading, idToken, getValidToken, user, storyData, setStoryData, addToast }) {
  // Social state - ratings
  const [ratingData, setRatingData] = useState({ avg: 0, count: 0, userRating: null, commentCount: 0 });
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Social state - comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

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
  }, [user, storyId, storyData, setStoryData]);

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
      const token = getValidToken ? await getValidToken() : idToken;
      await fetch(`${API_URL}/api/stories/${storyId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating }),
      });
    } catch {
      setRatingData(oldData);
    } finally {
      setRatingSubmitting(false);
    }
  }, [user, idToken, getValidToken, storyId, ratingData, ratingSubmitting]);

  // ── Post comment ──
  const handlePostComment = useCallback(async () => {
    if (!user || !idToken || !commentText.trim() || postingComment) return;
    setPostingComment(true);
    const text = commentText.trim();
    setCommentText('');

    try {
      const token = getValidToken ? await getValidToken() : idToken;
      const res = await fetch(`${API_URL}/api/stories/${storyId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  }, [user, idToken, getValidToken, storyId, commentText, postingComment, addToast]);

  // ── Delete comment ──
  const handleDeleteComment = useCallback(async (commentId) => {
    if (!idToken) return;
    const prev = [...comments];
    setComments((c) => c.filter((x) => x.id !== commentId));
    setRatingData((r) => ({ ...r, commentCount: Math.max(0, r.commentCount - 1) }));

    try {
      const token = getValidToken ? await getValidToken() : idToken;
      const res = await fetch(`${API_URL}/api/stories/${storyId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setComments(prev);
      setRatingData((r) => ({ ...r, commentCount: r.commentCount + 1 }));
      addToast('Failed to delete comment', 'error');
    }
  }, [idToken, getValidToken, storyId, comments, addToast]);

  return {
    ratingData,
    setRatingData,
    hoverRating,
    setHoverRating,
    ratingSubmitting,
    comments,
    commentsLoading,
    commentText,
    setCommentText,
    postingComment,
    handleToggleLike,
    handleRate,
    handlePostComment,
    handleDeleteComment,
  };
}
