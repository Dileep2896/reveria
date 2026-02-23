import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../utils/storyHelpers';

export default function useAdminUsers(idToken) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async (pg, q) => {
    if (!idToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, page_size: 20 });
      if (q) params.set('search', q);
      const res = await fetch(`${API_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Admin fetch users failed:', err);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  // Track whether initial fetch has happened
  const initialFetchDone = useRef(false);

  // Debounced search (also handles initial load)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers(1, search);
      initialFetchDone.current = true;
    }, initialFetchDone.current ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchUsers]);

  // Page change (skip initial since debounce handles it)
  const prevPage = useRef(page);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    fetchUsers(page, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const updateTier = useCallback(async (uid, tier) => {
    if (!idToken) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, tier } : u));
      return true;
    } catch (err) {
      console.error('Update tier failed:', err);
      return false;
    }
  }, [idToken]);

  const deleteUser = useCallback(async (uid, deleteStories = false) => {
    if (!idToken) return;
    try {
      const params = new URLSearchParams();
      if (deleteStories) params.set('delete_stories', 'true');
      const res = await fetch(`${API_URL}/api/admin/users/${uid}?${params}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(prev => prev.filter(u => u.uid !== uid));
      setTotal(prev => prev - 1);
      return true;
    } catch (err) {
      console.error('Delete user failed:', err);
      return false;
    }
  }, [idToken]);

  const refresh = useCallback(() => {
    fetchUsers(page, search);
  }, [fetchUsers, page, search]);

  return { users, loading, page, setPage, total, search, setSearch, updateTier, deleteUser, refresh };
}
