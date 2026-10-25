import './Sidebar.css';

/**
 * Sidebar Navigation Component (Day 7)
 * 
 * WHY A SIDEBAR COMPONENT?
 * - Provides consistent, persistent navigation across all views (Dashboard, Groups, Expenses, Sandbox).
 * - Houses quick-action shortcuts (Add Expense, Create Group) accessible anywhere in the app.
 * - Displays active user profile and real-time backend API connection status.
 */
function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenCreateGroupModal,
  onOpenAddExpenseModal,
}) {
  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">💸</div>
        <div className="brand-text">
          <span className="brand-title">ExpenseSplit</span>
        </div>
      </div>

      {/* Primary Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">MENU</div>
        <button
          className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Groups &amp; Members</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <span className="nav-icon">🧾</span>
          <span className="nav-label">Expenses</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeTab === 'settlements' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlements')}
        >
          <span className="nav-icon">🤝</span>
          <span className="nav-label">Settle Up</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <span className="nav-icon">📜</span>
          <span className="nav-label">Activity Log</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <span className="nav-icon">📈</span>
          <span className="nav-label">Reports &amp; Export</span>
        </button>
      </nav>

      {/* Quick Action Shortcuts */}
      <div className="sidebar-quick-actions">
        <button
          className="btn-quick-action btn-add-expense"
          onClick={onOpenAddExpenseModal}
        >
          <span>➕</span>
          <span>Add Expense</span>
        </button>

        <button
          className="btn-quick-action btn-create-group"
          onClick={onOpenCreateGroupModal}
        >
          <span>👥</span>
          <span>New Group</span>
        </button>
      </div>

      {/* User Session Footer */}
      <div className="sidebar-user-footer">
        {currentUser ? (
          <div className="user-profile-widget">
            <div className="user-avatar">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name-row">
                <span className="user-name">{currentUser.name}</span>
                <span className="currency-tag">{currentUser.defaultCurrency || 'USD'}</span>
              </div>
              <span className="user-email">{currentUser.email}</span>
            </div>
            <button
              className="btn-sidebar-logout"
              onClick={onLogout}
              title="Log out and clear stored JWT token"
            >
              🚪
            </button>
          </div>
        ) : (
          <button
            className="btn-sidebar-login"
            onClick={onOpenAuthModal}
          >
            <span>🔑</span>
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
