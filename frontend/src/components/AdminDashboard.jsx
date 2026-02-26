import { useState, useMemo } from 'react';
import useAdminUsers from '../hooks/useAdminUsers';
import AdminStatsGrid from './admin/AdminStatsGrid';
import AdminFilterPanel from './admin/AdminFilterPanel';
import AdminUserTable from './admin/AdminUserTable';
import UserDetailModal from './admin/UserDetailModal';
import './AdminDashboard.css';

export default function AdminDashboard({ idToken, addToast }) {
  const { users, loading, page, setPage, total, search, setSearch, updateTier, deleteUser } = useAdminUsers(idToken);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filterTier, setFilterTier] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterVerified, setFilterVerified] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const pageSize = 20;

  const filteredUsers = useMemo(() => {
    let list = users;
    if (filterTier !== 'all') {
      list = list.filter(u => (u.tier || 'free') === filterTier);
    }
    if (filterProvider !== 'all') {
      list = list.filter(u => u.provider === filterProvider);
    }
    if (filterVerified !== 'all') {
      list = list.filter(u => filterVerified === 'yes' ? u.email_verified : !u.email_verified);
    }
    if (sortBy === 'oldest') {
      list = [...list].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    } else if (sortBy === 'most_stories') {
      list = [...list].sort((a, b) => (b.story_count || 0) - (a.story_count || 0));
    } else {
      list = [...list].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }
    return list;
  }, [users, filterTier, filterProvider, filterVerified, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = filterTier !== 'all' || filterProvider !== 'all' || filterVerified !== 'all';

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      totalUsers: total,
      activeToday: users.filter(u => u.last_sign_in && (now - u.last_sign_in) < dayMs).length,
      totalStories: users.reduce((sum, u) => sum + (u.story_count || 0), 0),
    };
  }, [users, total]);

  const handleUpdateTier = async (uid, tier) => {
    const ok = await updateTier(uid, tier);
    if (ok) addToast(`Tier updated to ${tier}`, 'success');
    else addToast('Failed to update tier', 'error');
    return ok;
  };

  const handleDeleteUser = async (uid, deleteStories) => {
    const ok = await deleteUser(uid, deleteStories);
    if (ok) addToast('User deleted', 'success');
    else addToast('Failed to delete user', 'error');
    return ok;
  };

  const clearFilters = () => { setFilterTier('all'); setFilterProvider('all'); setFilterVerified('all'); setSortBy('newest'); };

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Hero */}
        <div className="admin-hero">
          <div className="admin-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1>Admin Dashboard</h1>
          <p>Manage users, tiers, and platform activity</p>
        </div>

        {/* Stats */}
        <AdminStatsGrid stats={stats} users={users} />

        {/* Users Card */}
        <div className="admin-users-card">
          <AdminFilterPanel
            search={search}
            setSearch={setSearch}
            filterTier={filterTier}
            setFilterTier={setFilterTier}
            filterProvider={filterProvider}
            setFilterProvider={setFilterProvider}
            filterVerified={filterVerified}
            setFilterVerified={setFilterVerified}
            sortBy={sortBy}
            setSortBy={setSortBy}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
          />

          <AdminUserTable
            filteredUsers={filteredUsers}
            hasActiveFilters={hasActiveFilters}
            users={users}
            search={search}
            loading={loading}
            setSelectedUser={setSelectedUser}
            handleUpdateTier={handleUpdateTier}
            clearFilters={clearFilters}
            totalPages={totalPages}
            page={page}
            setPage={setPage}
          />
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdateTier={handleUpdateTier}
          onDeleteUser={handleDeleteUser}
          idToken={idToken}
        />
      )}
    </div>
  );
}
