import './Dashboard.css';

const TYPE_ICONS = {
  Trip: '✈️',
  Home: '🏠',
  Couple: '💑',
  Project: '💻',
  Other: '📁',
};

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

/**
 * Dashboard Component (Day 7: Dashboard + API Integration)
 * 
 * WHY A DASHBOARD VIEW?
 * - Aggregates real-time financial data from multiple API endpoints (groups, expenses, members).
 * - Implements loading, error, and empty UI states driven purely by React state and API responses.
 * - Adheres strictly to data integrity: Only displays mathematically verified metrics supported
 *   by the backend so far (Total Group Spending, Group Cards, Recent Expenses), marking
 *   unimplemented balance engine metrics as "Coming on Day 9".
 */
function Dashboard({
  currentUser,
  groups = [],
  expenses = [],
  loadingGroups,
  loadingExpenses,
  groupsError,
  expensesError,
  onOpenGroup,
  onOpenCreateGroupModal,
  onOpenAddExpenseModal,
  onOpenSettleUpModal,
  onRefresh,
}) {
  // 1. Compute Total Spending across all fetched expenses
  const totalSpending = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  // 2. Compute group-specific spending map
  const groupSpendingMap = expenses.reduce((acc, exp) => {
    if (exp.group) {
      const gId = String(exp.group);
      acc[gId] = (acc[gId] || 0) + Number(exp.amount || 0);
    }
    return acc;
  }, {});

  // 3. Compute Current User's Net Balances across all expenses
  let userTotalPaid = 0;
  let userTotalOwed = 0;

  if (currentUser?.name) {
    const currentName = currentUser.name.toLowerCase();
    const currentUserId = currentUser.id || currentUser._id ? String(currentUser.id || currentUser._id) : null;

    expenses.forEach((exp) => {
      // Check Payers
      if (Array.isArray(exp.payers) && exp.payers.length > 0) {
        exp.payers.forEach((p) => {
          if (
            (p.name && p.name.toLowerCase() === currentName) ||
            (currentUserId && p.user && String(p.user) === currentUserId)
          ) {
            userTotalPaid += Number(p.amount || 0);
          }
        });
      } else if (exp.paidBy && exp.paidBy.toLowerCase() === currentName) {
        userTotalPaid += Number(exp.amount || 0);
      }

      // Check Splits
      if (Array.isArray(exp.splits)) {
        exp.splits.forEach((s) => {
          if (
            (s.name && s.name.toLowerCase() === currentName) ||
            (currentUserId && s.user && String(s.user) === currentUserId)
          ) {
            userTotalOwed += Number(s.amountOwed || 0);
          }
        });
      }
    });
  }

  const netBalance = userTotalPaid - userTotalOwed;
  const youAreOwed = netBalance > 0 ? netBalance : 0;
  const youOwe = netBalance < 0 ? Math.abs(netBalance) : 0;

  // 4. Extract 5 most recent expenses
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt))
    .slice(0, 5);

  return (
    <div className="dashboard-page">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            Welcome back, {currentUser?.name || 'Explorer'}! 👋
          </h1>
          <p className="dashboard-subtitle">
            Track group expenses, view balances, and settle debts.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            className="btn-dash btn-dash-primary"
            onClick={onOpenAddExpenseModal}
          >
            ➕ Add Expense
          </button>
          <button
            className="btn-dash btn-dash-settle"
            onClick={onOpenSettleUpModal}
          >
            🤝 Settle Up
          </button>
          <button
            className="btn-dash btn-dash-secondary"
            onClick={onOpenCreateGroupModal}
          >
            👥 New Group
          </button>
          <button
            className="btn-dash btn-dash-refresh"
            onClick={onRefresh}
            title="Refresh data"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Metric Summary Cards Grid */}
      <section className="metrics-grid">
        {/* Card 1: Total Group Spending */}
        <div className="metric-card total-spending-card">
          <div className="metric-header">
            <span className="metric-label">Total Spending</span>
            <span className="metric-icon">💰</span>
          </div>
          <div className="metric-value">
            ${totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="metric-caption">
            Across <strong>{expenses.length}</strong> recorded expenses
          </div>
        </div>

        {/* Card 2: Active Groups */}
        <div className="metric-card active-groups-card">
          <div className="metric-header">
            <span className="metric-label">Active Groups</span>
            <span className="metric-icon">👥</span>
          </div>
          <div className="metric-value">{groups.length}</div>
          <div className="metric-caption">
            {groups.length === 1 ? '1 active group' : `${groups.length} active groups`}
          </div>
        </div>

        {/* Card 3: Amount to Receive */}
        <div className="metric-card owed-card" style={{ borderLeft: youAreOwed > 0 ? '4px solid #16a34a' : '4px solid #e2e8f0' }}>
          <div className="metric-header">
            <span className="metric-label">You Are Owed</span>
            <span className="metric-icon">🟢</span>
          </div>
          <div className="metric-value" style={{ color: youAreOwed > 0 ? '#16a34a' : '#1e293b' }}>
            ${youAreOwed.toFixed(2)}
          </div>
          <div className="metric-caption">
            {youAreOwed > 0 ? 'To be paid back to you' : 'No outstanding credits'}
          </div>
        </div>

        {/* Card 4: Amount Owed */}
        <div className="metric-card owes-card" style={{ borderLeft: youOwe > 0 ? '4px solid #dc2626' : '4px solid #e2e8f0' }}>
          <div className="metric-header">
            <span className="metric-label">You Owe</span>
            <span className="metric-icon">🔴</span>
          </div>
          <div className="metric-value" style={{ color: youOwe > 0 ? '#dc2626' : '#1e293b' }}>
            ${youOwe.toFixed(2)}
          </div>
          <div className="metric-caption">
            {youOwe > 0 ? 'Your total group debts' : 'You are fully settled up!'}
          </div>
        </div>
      </section>

      {/* Main Two-Column Dashboard Content */}
      <div className="dashboard-grid-layout">
        {/* Left Column: Your Groups */}
        <section className="dash-column">
          <div className="dash-section-header">
            <div className="section-title-wrap">
              <h2>👥 Your Groups ({groups.length})</h2>
            </div>
            <button className="link-action-btn" onClick={onOpenCreateGroupModal}>
              + Create Group
            </button>
          </div>

          {loadingGroups ? (
            <div className="dash-card loading-state-card">
              <div className="spinner"></div>
              <p>Loading groups...</p>
            </div>
          ) : groupsError ? (
            <div className="dash-card error-state-card">
              <p>⚠️ Error loading groups: {groupsError}</p>
              <button className="btn btn-secondary" onClick={onRefresh}>Retry</button>
            </div>
          ) : groups.length === 0 ? (
            <div className="dash-card empty-state-card">
              <div className="empty-emoji">📂</div>
              <h3>No Groups Yet</h3>
              <p>Create a group to start splitting bills, trips, and flat expenses with friends!</p>
              <button className="btn btn-primary" onClick={onOpenCreateGroupModal}>
                ➕ Create Your First Group
              </button>
            </div>
          ) : (
            <div className="dash-group-cards-list">
              {groups.map((group) => {
                const gId = group.id || group._id;
                const icon = TYPE_ICONS[group.groupType] || '📁';
                const memberCount = group.members?.length || 0;
                const groupSpend = groupSpendingMap[String(gId)] || 0;

                return (
                  <div key={gId} className="dash-group-card" onClick={() => onOpenGroup(group)}>
                    <div className="group-card-top-row">
                      <div className="group-identity">
                        <span className="group-avatar-icon">{icon}</span>
                        <div>
                          <h4 className="group-name-text">{group.name}</h4>
                          <span className="group-type-label">{group.groupType || 'Group'}</span>
                        </div>
                      </div>
                      <span className="group-currency-tag">{group.baseCurrency || 'USD'}</span>
                    </div>

                    <div className="group-stats-row">
                      <div className="group-stat-item">
                        <span className="stat-label">Members:</span>
                        <strong>{memberCount}</strong>
                      </div>
                      <div className="group-stat-item">
                        <span className="stat-label">Total Spent:</span>
                        <strong>${groupSpend.toFixed(2)}</strong>
                      </div>
                    </div>

                    {group.simplifyDebts && (
                      <div className="simplify-indicator">
                        ⚡ Simplified Debts Active
                      </div>
                    )}

                    <div className="group-card-action-bar">
                      <span className="open-group-link">Open Group Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Recent Expenses Feed */}
        <section className="dash-column">
          <div className="dash-section-header">
            <div className="section-title-wrap">
              <h2>🧾 Recent Expenses ({expenses.length})</h2>
            </div>
            <button className="link-action-btn" onClick={onOpenAddExpenseModal}>
              + Add Expense
            </button>
          </div>

          {loadingExpenses ? (
            <div className="dash-card loading-state-card">
              <div className="spinner"></div>
              <p>Loading recent expenses...</p>
            </div>
          ) : expensesError ? (
            <div className="dash-card error-state-card">
              <p>⚠️ Error loading expenses: {expensesError}</p>
              <button className="btn btn-secondary" onClick={onRefresh}>Retry</button>
            </div>
          ) : recentExpenses.length === 0 ? (
            <div className="dash-card empty-state-card">
              <div className="empty-emoji">🧾</div>
              <h3>No Expenses Recorded</h3>
              <p>Record your first expense to start tracking splits and balances.</p>
              <button className="btn btn-primary" onClick={onOpenAddExpenseModal}>
                ➕ Add New Expense
              </button>
            </div>
          ) : (
            <div className="dash-expense-feed">
              {recentExpenses.map((expense) => {
                const categoryIcon = CATEGORY_ICONS[expense.category] || '🧾';
                const formattedDate = expense.expenseDate
                  ? new Date(expense.expenseDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Recent';

                return (
                  <div key={expense.id || expense._id} className="dash-expense-item">
                    <div className="expense-item-icon">{categoryIcon}</div>
                    <div className="expense-item-details">
                      <div className="expense-title-row">
                        <span className="expense-title-text">{expense.title}</span>
                        <span className="expense-amount-text">
                          ${Number(expense.amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="expense-sub-row">
                        <span>Paid by <strong>{expense.paidBy}</strong></span>
                        <span>&bull;</span>
                        <span>{formattedDate}</span>
                        <span>&bull;</span>
                        <span className="expense-cat-name">{expense.category || 'General'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
