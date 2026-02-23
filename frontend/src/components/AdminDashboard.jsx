import { useState, useEffect, useMemo } from 'react';
import useAdminUsers from '../hooks/useAdminUsers';
import { API_URL } from '../utils/storyHelpers';
import './AdminDashboard.css';

function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TierPill({ tier, isAdmin: admin }) {
  if (admin) return <span className="admin-tier admin-tier--admin">admin</span>;
  const cls = `admin-tier admin-tier--${tier || 'free'}`;
  return <span className={cls}>{tier || 'free'}</span>;
}

function VerifiedBadge({ verified }) {
  if (verified) return (
    <span className="admin-verified admin-verified--yes" title="Email verified">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
    </span>
  );
  return (
    <span className="admin-verified admin-verified--no" title="Email not verified">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="admin-skeleton-row">
      <td>
        <div className="admin-user-cell">
          <div className="admin-skel admin-skel-avatar" />
          <div>
            <div className="admin-skel admin-skel-name" />
            <div className="admin-skel admin-skel-email" />
          </div>
        </div>
      </td>
      <td><div className="admin-skel admin-skel-text-sm" /></td>
      <td><div className="admin-skel admin-skel-pill" /></td>
      <td><div className="admin-skel admin-skel-number" /></td>
      <td><div className="admin-skel admin-skel-date" /></td>
      <td><div className="admin-skel admin-skel-actions" /></td>
    </tr>
  );
}

function SkeletonTable() {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>User</th><th>Provider</th><th>Tier</th><th>Stories</th><th>Joined</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
      </tbody>
    </table>
  );
}

function UserDetailModal({ user, onClose, onUpdateTier, onDeleteUser, idToken }) {
  const [tier, setTier] = useState(user.tier || 'free');
  const [deleteStories, setDeleteStories] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [detailedUser, setDetailedUser] = useState(user);

  // Fetch detailed stats when modal opens
  useEffect(() => {
    if (!idToken || !user.uid) return;
    fetch(`${API_URL}/api/admin/users/${user.uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDetailedUser(data); })
      .catch(() => {});
  }, [user.uid, idToken]);

  const handleTierChange = async (newTier) => {
    setTier(newTier);
    setUpdating(true);
    await onUpdateTier(user.uid, newTier);
    setUpdating(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDeleteUser(user.uid, deleteStories);
    setDeleting(false);
    if (ok) onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          {user.photo_url ? (
            <img src={user.photo_url} alt="" className="admin-modal-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="admin-modal-avatar-placeholder">{getInitials(user.display_name)}</div>
          )}
          <div>
            <h2>{user.display_name || 'No name'}</h2>
            <p className="admin-modal-email">{user.email}</p>
          </div>
        </div>

        <div className="admin-modal-stats">
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value">{detailedUser.story_count ?? 0}</div>
            <div className="admin-modal-stat-label">Stories</div>
          </div>
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value">{detailedUser.comment_count ?? '-'}</div>
            <div className="admin-modal-stat-label">Comments</div>
          </div>
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value">{detailedUser.likes_given ?? '-'}</div>
            <div className="admin-modal-stat-label">Likes Given</div>
          </div>
        </div>

        <div className="admin-modal-stats">
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value" style={{ fontSize: '0.85rem' }}>{detailedUser.provider === 'google.com' ? 'Google' : detailedUser.provider === 'password' ? 'Email' : detailedUser.provider || '-'}</div>
            <div className="admin-modal-stat-label">Provider</div>
          </div>
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value">
              <span className={`admin-verified-label ${detailedUser.email_verified ? 'admin-verified-label--yes' : 'admin-verified-label--no'}`}>
                {detailedUser.email_verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <div className="admin-modal-stat-label">Email</div>
          </div>
          <div className="admin-modal-stat">
            <div className="admin-modal-stat-value" style={{ fontSize: '0.85rem' }}>{formatDate(detailedUser.created_at)}</div>
            <div className="admin-modal-stat-label">Joined</div>
          </div>
        </div>

        {detailedUser.usage && Object.keys(detailedUser.usage).length > 0 && (
          <div className="admin-modal-section">
            <label>Usage (Today)</label>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {Object.entries(detailedUser.usage).map(([k, v]) => (
                <div key={k}><span style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-modal-section">
          <label>Tier</label>
          <select className="admin-modal-tier-select" value={tier} onChange={e => handleTierChange(e.target.value)} disabled={updating || user.is_admin}>
            <option value="free">Free</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        {!user.is_admin && (
          <div className="admin-modal-danger">
            <h3>Danger Zone</h3>
            <label className="admin-modal-checkbox">
              <input type="checkbox" checked={deleteStories} onChange={e => setDeleteStories(e.target.checked)} />
              Also delete all stories and media
            </label>
            <button className="admin-modal-delete-btn" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        )}

        <button className="admin-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const TIER_OPTIONS = ['all', 'free', 'standard', 'pro'];
const PROVIDER_OPTIONS = [['all', 'All'], ['google.com', 'Google'], ['password', 'Email']];
const VERIFIED_OPTIONS = [['all', 'All'], ['yes', 'Verified'], ['no', 'Unverified']];
const SORT_OPTIONS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['most_stories', 'Most Stories']];

export default function AdminDashboard({ idToken, addToast }) {
  const { users, loading, page, setPage, total, search, setSearch, updateTier, deleteUser } = useAdminUsers(idToken);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filterTier, setFilterTier] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterVerified, setFilterVerified] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const pageSize = 20;

  // Client-side filter + sort
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
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.totalUsers}</div>
            <div className="admin-stat-label">Total Users</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.activeToday}</div>
            <div className="admin-stat-label">Active Today</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.totalStories}</div>
            <div className="admin-stat-label">Total Stories</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{users.filter(u => u.is_admin).length}</div>
            <div className="admin-stat-label">Admins</div>
          </div>
        </div>

        {/* Users Card */}
        <div className="admin-users-card">
          {/* Search */}
          <div className="admin-search-row">
            <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="admin-search"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {(search || hasActiveFilters) && (
              <button className="admin-search-clear" onClick={() => { setSearch(''); clearFilters(); }} title="Clear all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="admin-filters">
            <div className="admin-filter-group">
              <span className="admin-filter-label">Tier</span>
              <div className="admin-filter-pills">
                {TIER_OPTIONS.map(t => (
                  <button
                    key={t}
                    className={`admin-filter-pill${filterTier === t ? ' admin-filter-pill--active' : ''}${t !== 'all' ? ` admin-filter-pill--${t}` : ''}`}
                    onClick={() => setFilterTier(t)}
                  >
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-filter-group">
              <span className="admin-filter-label">Provider</span>
              <div className="admin-filter-pills">
                {PROVIDER_OPTIONS.map(([val, label]) => (
                  <button
                    key={val}
                    className={`admin-filter-pill${filterProvider === val ? ' admin-filter-pill--active' : ''}`}
                    onClick={() => setFilterProvider(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-filter-group">
              <span className="admin-filter-label">Status</span>
              <div className="admin-filter-pills">
                {VERIFIED_OPTIONS.map(([val, label]) => (
                  <button
                    key={val}
                    className={`admin-filter-pill${filterVerified === val ? ' admin-filter-pill--active' : ''}${val === 'yes' ? ' admin-filter-pill--verified' : ''}${val === 'no' ? ' admin-filter-pill--unverified' : ''}`}
                    onClick={() => setFilterVerified(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-filter-group">
              <span className="admin-filter-label">Sort</span>
              <div className="admin-filter-pills">
                {SORT_OPTIONS.map(([val, label]) => (
                  <button
                    key={val}
                    className={`admin-filter-pill${sortBy === val ? ' admin-filter-pill--active' : ''}`}
                    onClick={() => setSortBy(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <SkeletonTable />
          ) : (
            <>
              {hasActiveFilters && (
                <div className="admin-filter-status">
                  Showing {filteredUsers.length} of {users.length} users
                  <button className="admin-filter-clear-link" onClick={clearFilters}>Clear filters</button>
                </div>
              )}
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Provider</th>
                    <th>Tier</th>
                    <th>Stories</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.uid} onClick={() => setSelectedUser(u)}>
                      <td>
                        <div className="admin-user-cell">
                          {u.photo_url ? (
                            <img src={u.photo_url} alt="" className="admin-avatar" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="admin-avatar-placeholder">{getInitials(u.display_name)}</div>
                          )}
                          <div>
                            <div className="admin-user-name">{u.display_name || 'No name'} <VerifiedBadge verified={u.email_verified} /></div>
                            <div className="admin-user-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.provider === 'google.com' ? 'Google' : u.provider === 'password' ? 'Email' : u.provider}</td>
                      <td><TierPill tier={u.tier} isAdmin={u.is_admin} /></td>
                      <td>{u.story_count ?? 0}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <div className="admin-actions" onClick={e => e.stopPropagation()}>
                          <select
                            className="admin-tier-select"
                            value={u.tier || 'free'}
                            onChange={e => handleUpdateTier(u.uid, e.target.value)}
                          >
                            <option value="free">Free</option>
                            <option value="standard">Standard</option>
                            <option value="pro">Pro</option>
                          </select>
                          {!u.is_admin && (
                            <button className="admin-delete-btn" onClick={() => setSelectedUser(u)}>
                              Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {hasActiveFilters ? 'No users match filters' : search ? 'No users found' : 'No users yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {totalPages > 1 && !hasActiveFilters && (
                <div className="admin-pagination">
                  <button className="admin-page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>&lt;</button>
                  <span>Page {page} of {totalPages}</span>
                  <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>&gt;</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User detail modal */}
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
