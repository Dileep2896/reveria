import { useState, useEffect } from 'react';
import { formatDate } from './adminHelpers';
import UserAvatar from '../UserAvatar';
import { API_URL } from '../../utils/storyHelpers';

export default function UserDetailModal({ user, onClose, onUpdateTier, onDeleteUser, idToken }) {
  const [tier, setTier] = useState(user.tier || 'free');
  const [deleteStories, setDeleteStories] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [detailedUser, setDetailedUser] = useState(user);

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
          <UserAvatar photoURL={user.photo_url} name={user.display_name || user.email || '?'} size={56} />
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
