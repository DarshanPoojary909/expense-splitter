import './GroupList.css';

const TYPE_ICONS = {
  Trip: '✈️',
  Home: '🏠',
  Couple: '💑',
  Project: '💻',
  Other: '📁',
};

function GroupList({
  groups,
  loading,
  error,
  onOpenGroup,
  onCreateGroupClick,
  onRefresh,
}) {
  if (loading) {
    return (
      <div className="card group-list-card">
        <div className="group-loading-state">
          <div className="spinner"></div>
          <p>Loading your groups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card group-list-card">
        <div className="group-error-state">
          <p>Error loading groups: {error}</p>
          <button className="btn btn-primary" onClick={onRefresh}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card group-list-card">
      <div className="group-list-header">
        <div>
          <h2>👥 My Groups ({groups.length})</h2>
          <p className="subtitle">
            Manage your groups and split expenses with friends.
          </p>
        </div>
        <div className="group-list-actions">
          <button className="btn btn-secondary" onClick={onRefresh} title="Refresh groups list">
            🔄 Refresh
          </button>
          <button className="btn btn-primary" onClick={onCreateGroupClick}>
            ➕ Create Group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty-group-state">
          <div className="empty-icon">📂</div>
          <h3>No Groups Found</h3>
          <p>
            You are not a member of any group yet. Create your first group to start splitting expenses with friends!
          </p>
          <button className="btn btn-primary" onClick={onCreateGroupClick}>
            ➕ Create My First Group
          </button>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => {
            const groupId = group.id || group._id;
            const icon = TYPE_ICONS[group.groupType] || '📁';

            return (
              <div key={groupId} className="group-card">
                <div className="group-card-top">
                  <span className="group-type-badge">
                    {icon} {group.groupType}
                  </span>
                  <span className="group-currency-badge">
                    {group.baseCurrency || 'USD'}
                  </span>
                </div>

                <h3 className="group-card-name">{group.name}</h3>

                {group.description && (
                  <p className="group-card-desc">{group.description}</p>
                )}

                <div className="group-card-meta">
                  <span className="meta-pill">
                    👥 {group.members ? group.members.length : (group.memberCount || 0)} {group.members?.length === 1 ? 'member' : 'members'}
                  </span>
                  {group.simplifyDebts && (
                    <span className="meta-pill simplify-pill" title="Simplification algorithm enabled">
                      ⚡ Simplified Debts
                    </span>
                  )}
                </div>

                <div className="group-card-footer">
                  <button
                    className="btn btn-open-group"
                    onClick={() => onOpenGroup(group)}
                  >
                    📂 Open Group →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GroupList;
