import { useState, useEffect } from 'react';
import './ActivityView.css';
import { fetchUserActivity, fetchGroupActivity } from '../services/activityApi';

const ACTION_CONFIG = {
  EXPENSE_CREATED: { icon: '➕', label: 'Expense Added', color: '#16a34a', bg: '#dcfce7' },
  EXPENSE_UPDATED: { icon: '✏️', label: 'Expense Edited', color: '#2563eb', bg: '#dbeafe' },
  EXPENSE_DELETED: { icon: '🗑️', label: 'Expense Deleted', color: '#dc2626', bg: '#fee2e2' },
  SETTLEMENT_RECORDED: { icon: '🤝', label: 'Payment Recorded', color: '#7c3aed', bg: '#ede9fe' },
  MEMBER_ADDED: { icon: '👤', label: 'Member Joined', color: '#0d9488', bg: '#ccfbf1' },
  MEMBER_REMOVED: { icon: '🚪', label: 'Member Left', color: '#ea580c', bg: '#ffedd5' },
  GROUP_CREATED: { icon: '👥', label: 'Group Created', color: '#4338ca', bg: '#e0e7ff' },
  GROUP_UPDATED: { icon: '⚙️', label: 'Group Updated', color: '#475569', bg: '#f1f5f9' },
};

/**
 * ActivityView Component (Day 13: Financial History & Audit Trail)
 */
function ActivityView({ groups = [], authToken }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadActivities = async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      let logs = [];
      if (selectedGroupId) {
        logs = await fetchGroupActivity(selectedGroupId, authToken, 100);
      } else {
        logs = await fetchUserActivity(authToken, 100);
      }
      setActivities(logs);
    } catch (err) {
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, authToken]);

  return (
    <div className="activity-view">
      {/* Header & Filter Controls */}
      <div className="activity-header">
        <div>
          <h2>📜 Financial Activity &amp; Audit Trail</h2>
          <p className="activity-sub">
            Immutable chronological record of all group expenses, member changes, and settlement payments.
          </p>
        </div>

        <div className="activity-filter-bar">
          <label htmlFor="activity-filter-select">Filter by Group:</label>
          <select
            id="activity-filter-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={loading}
          >
            <option value="">-- All My Groups --</option>
            {groups.map((g) => (
              <option key={g.id || g._id} value={g.id || g._id}>
                {g.name}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={loadActivities} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card loading-card" style={{ padding: '30px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Fetching immutable audit logs from backend...</p>
        </div>
      ) : error ? (
        <div className="card error-card" style={{ padding: '20px' }}>
          <p>⚠️ Error: {error}</p>
          <button className="btn btn-primary" onClick={loadActivities}>Retry</button>
        </div>
      ) : activities.length === 0 ? (
        <div className="card empty-card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📜</div>
          <h3>No Activity Logs Found</h3>
          <p style={{ color: '#64748b' }}>Create a group, add an expense, or record a settlement to generate history.</p>
        </div>
      ) : (
        <div className="timeline-feed">
          {activities.map((log) => {
            const config = ACTION_CONFIG[log.action] || {
              icon: '📌',
              label: log.action,
              color: '#64748b',
              bg: '#f1f5f9',
            };

            const dateStr = log.createdAt
              ? new Date(log.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Recently';

            const groupName = log.group
              ? groups.find((g) => String(g.id || g._id) === String(log.group))?.name || 'Group'
              : null;

            return (
              <div key={log.id || log._id} className="timeline-item">
                <div className="timeline-icon-box" style={{ background: config.bg, color: config.color }}>
                  {config.icon}
                </div>

                <div className="timeline-content">
                  <div className="timeline-top-row">
                    <span className="action-tag" style={{ color: config.color, borderColor: config.color }}>
                      {config.label}
                    </span>
                    {groupName && <span className="timeline-group-tag">👥 {groupName}</span>}
                    <span className="timeline-date">{dateStr}</span>
                  </div>

                  <p className="timeline-desc">{log.description}</p>

                  {log.userName && (
                    <span className="timeline-actor">
                      Initiated by: <strong>{log.userName}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivityView;
