import { useState, useCallback } from 'react';
import { API_URL } from '../utils/storyHelpers';

export default function useBookDetails({ storyId, idToken }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  const generateDetails = useCallback(async () => {
    if (!storyId || !idToken) return null;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/book-details/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetails(data.book_details);
      return data;
    } catch (err) {
      console.error('Failed to generate book details:', err);
      setError('Failed to generate book details');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [storyId, idToken]);

  const saveDetails = useCallback(async (updatedDetails) => {
    if (!storyId || !idToken) return false;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/book-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updatedDetails),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetails(data.book_details);
      setEditing(false);
      return true;
    } catch (err) {
      console.error('Failed to save book details:', err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [storyId, idToken]);

  const fetchPublicDetails = useCallback(async (sid) => {
    const id = sid || storyId;
    if (!id) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/public/stories/${id}/details`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetails(data.book_details || null);
      return data;
    } catch (err) {
      console.error('Failed to fetch public details:', err);
      setError('Failed to load book details');
      return null;
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  const toggleEditing = useCallback(() => setEditing((v) => !v), []);

  return {
    details,
    setDetails,
    loading,
    generating,
    saving,
    editing,
    error,
    generateDetails,
    saveDetails,
    fetchPublicDetails,
    toggleEditing,
    setEditing,
  };
}
