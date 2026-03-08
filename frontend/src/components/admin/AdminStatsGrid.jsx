export default function AdminStatsGrid({ stats, users }) {
  return (
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
  );
}
