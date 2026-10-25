import { useState } from 'react';
import './GroupDetail.css';

const CATEGORY_ICONS = {
  'Food & Dining': '🍔',
  'Groceries': '🛒',
  'Transportation': '🚗',
  'Accommodation': '🏨',
  'Entertainment': '🎬',
  'Utilities': '💡',
  'Shopping': '🛍️',
  'General': '🧾',
};

function GroupDetail({
  group,
  currentUser,
  groupExpenses = [],
  onBack,
  onAddMember,
  onRemoveMember,
  onUpdateGroup,
  onOpenAddExpense,
  onOpenSettleUp,
  isProcessing,
}) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [memberError, setMemberError] = useState(null);

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editType, setEditType] = useState(group.groupType || 'Other');
  const [editCurrency, setEditCurrency] = useState(group.baseCurrency || 'USD');
  const [editSimplify, setEditSimplify] = useState(group.simplifyDebts !== false);

  const currentUserId = String(currentUser?._id || currentUser?.id);
  const myMember = group.members?.find((m) => String(m.userId) === currentUserId);
  const isAdmin = myMember?.role === 'admin' || String(group.createdBy) === currentUserId;

  // Calculate total spending for this specific group
  const totalGroupSpending = groupExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberEmail && !newMemberName) {
      setMemberError('Please enter member email or name');
      return;
    }

    setMemberError(null);
    try {
      await onAddMember(group.id || group._id, {
        email: newMemberEmail.trim(),
        name: newMemberName.trim(),
        role: newMemberRole,
      });

      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('member');
      setShowAddMember(false);
    } catch (err) {
      setMemberError(err.message || 'Failed to add member');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await onUpdateGroup(group.id || group._id, {
        name: editName.trim(),
        groupType: editType,
        baseCurrency: editCurrency,
        simplifyDebts: editSimplify,
      });
      setIsEditingSettings(false);
    } catch (err) {
      alert(`Error updating group settings: ${err.message}`);
    }
  };

  return (
    <div className="card group-detail-card">
      <div className="group-detail-header">
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Back to All Groups
        </button>

        <div className="group-detail-actions">
          {onOpenAddExpense && (
            <button
              className="btn btn-primary"
              onClick={() => onOpenAddExpense(group.id || group._id)}
            >
              ➕ Add Expense
            </button>
          )}
          {onOpenSettleUp && (
            <button
              className="btn btn-secondary"
              onClick={onOpenSettleUp}
              style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
            >
              🤝 Settle Up
            </button>
          )}
          {isAdmin && !isEditingSettings && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditName(group.name);
                setEditType(group.groupType || 'Other');
                setEditCurrency(group.baseCurrency || 'USD');
                setEditSimplify(group.simplifyDebts !== false);
                setIsEditingSettings(true);
              }}
            >
              ⚙️ Settings
            </button>
          )}
        </div>
      </div>

      {/* Group Title & Badges */}
      {isEditingSettings ? (
        <form onSubmit={handleSaveSettings} className="settings-edit-form">
          <h3>Edit Group Settings</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Group Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Group Type</label>
              <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                <option value="Trip">✈️ Trip</option>
                <option value="Home">🏠 Home</option>
                <option value="Couple">💑 Couple</option>
                <option value="Project">💻 Project</option>
                <option value="Other">📁 Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Base Currency</label>
              <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editSimplify}
                  onChange={(e) => setEditSimplify(e.target.checked)}
                />
                <span>Simplify Debts</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={isProcessing}>
              Save Changes
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditingSettings(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="group-info-banner">
          <div className="group-title-row">
            <div>
              <h2>{group.name}</h2>
              {group.description && <p className="group-description">{group.description}</p>}
            </div>
            <div className="badges-row">
              <span className="badge badge-type">{group.groupType || 'Other'}</span>
              <span className="badge badge-currency">{group.baseCurrency || 'USD'}</span>
              {group.simplifyDebts && (
                <span className="badge badge-simplify">⚡ Simplify Debts: ON</span>
              )}
            </div>
          </div>

          {/* Group Financial Summary Cards */}
          <div className="group-summary-metrics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Total Group Spending
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                ${totalGroupSpending.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                Across {groupExpenses.length} group expenses
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Net Group Balances
              </div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#94a3b8', marginTop: '8px' }}>
                Coming in Day 9 (Balance Engine)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '4px' }}>
                ⚡ Multi-payer &amp; Split algorithm scheduled next
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Members Section */}
      <div className="members-section" style={{ marginTop: '24px' }}>
        <div className="members-header">
          <div>
            <h3>👥 Group Members ({group.members?.length || 0})</h3>
            <small style={{ color: '#64748b' }}>
              Stored directly inside the Group document (Embedded Subdocuments in MongoDB)
            </small>
          </div>

          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowAddMember(!showAddMember);
                setMemberError(null);
              }}
            >
              {showAddMember ? '✕ Close Add Member' : '➕ Add Member'}
            </button>
          )}
        </div>

        {/* Add Member Form */}
        {showAddMember && (
          <form onSubmit={handleAddMemberSubmit} className="add-member-form">
            <h4>Add New Member to Group</h4>
            {memberError && <div className="member-error-msg">{memberError}</div>}
            <div className="add-member-grid">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Friend Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                >
                  <option value="member">👤 Member</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddMember(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isProcessing}
              >
                {isProcessing ? 'Adding...' : 'Add Member to Group'}
              </button>
            </div>
          </form>
        )}

        {/* Members List */}
        <div className="members-list-table">
          <div className="members-table-header">
            <span>Member</span>
            <span>Role</span>
            <span>Joined Date</span>
            <span>Actions</span>
          </div>

          {group.members?.map((member) => {
            const memberId = member._id || member.id;
            const isUserSelf = String(member.userId) === currentUserId;
            const canRemove = (isAdmin || isUserSelf) && group.members.length > 1;

            return (
              <div key={memberId} className={`member-row ${isUserSelf ? 'self-member' : ''}`}>
                <div className="member-user-cell">
                  <div className="member-avatar">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong>
                      {member.name} {isUserSelf && <span className="you-pill">You</span>}
                    </strong>
                    {member.email && <div className="member-email">{member.email}</div>}
                  </div>
                </div>

                <div className="member-role-cell">
                  <span className={`role-badge ${member.role === 'admin' ? 'admin' : 'member'}`}>
                    {member.role === 'admin' ? '👑 Admin' : '👤 Member'}
                  </span>
                </div>

                <div className="member-date-cell">
                  {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Just now'}
                </div>

                <div className="member-actions-cell">
                  {canRemove ? (
                    <button
                      className="btn-remove-member"
                      onClick={() => onRemoveMember(group.id || group._id, memberId, member.name)}
                      disabled={isProcessing}
                      title={isUserSelf ? 'Leave group' : 'Remove member from group'}
                    >
                      {isUserSelf ? 'Leave Group' : 'Remove'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Expenses Section */}
      <div className="group-expenses-section" style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>🧾 Group Expenses ({groupExpenses.length})</h3>
            <small style={{ color: '#64748b' }}>Expenses linked to this group in MongoDB</small>
          </div>
          {onOpenAddExpense && (
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => onOpenAddExpense(group.id || group._id)}
            >
              ➕ Add Expense
            </button>
          )}
        </div>

        {groupExpenses.length === 0 ? (
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '8px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: '0 0 10px 0', color: '#64748b' }}>No expenses recorded for this group yet.</p>
            {onOpenAddExpense && (
              <button
                className="btn btn-secondary"
                onClick={() => onOpenAddExpense(group.id || group._id)}
              >
                Record Group Expense
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {groupExpenses.map((exp) => (
              <div
                key={exp.id || exp._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem' }}>{CATEGORY_ICONS[exp.category] || '🧾'}</span>
                  <div>
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.92rem' }}>
                      {exp.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Paid by <strong>{exp.paidBy}</strong> &bull; {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString() : 'Recent'} &bull; {exp.category}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0f172a' }}>
                  ${Number(exp.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupDetail;
