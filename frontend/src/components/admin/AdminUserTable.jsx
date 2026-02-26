import { formatDate } from './adminHelpers';
import UserAvatar from '../UserAvatar';

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

export default function AdminUserTable({ filteredUsers, hasActiveFilters, users, search, loading, setSelectedUser, handleUpdateTier, clearFilters, totalPages, page, setPage }) {
  if (loading) return <SkeletonTable />;

  return (
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
                  <UserAvatar photoURL={u.photo_url} name={u.display_name || u.email || '?'} size={32} />
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
  );
}
