import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import GroupList from './components/GroupList';
import GroupDetail from './components/GroupDetail';
import ExpenseList from './components/ExpenseList';
import ViewExpenseModal from './components/ViewExpenseModal';
import EditExpenseModal from './components/EditExpenseModal';
import CreateGroupModal from './components/CreateGroupModal';
import AddExpenseModal from './components/AddExpenseModal';
import SettleUpModal from './components/SettleUpModal';
import SettlementView from './components/SettlementView';
import ActivityView from './components/ActivityView';
import ReportsView from './components/ReportsView';
import AuthModal from './components/AuthModal';

import {
  fetchExpenses,
  createExpenseApi,
  updateExpenseApi,
  deleteExpenseApi,
} from './services/expenseApi';

import {
  getStoredToken,
  getStoredUser,
  logoutApi,
} from './services/authApi';

import {
  fetchMyGroups,
  fetchGroupById,
  createGroupApi,
  updateGroupApi,
  addMemberApi,
  removeMemberApi,
} from './services/groupApi';

import './App.css';

/**
 * Main Application Component
 */
function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [authToken, setAuthToken] = useState(() => getStoredToken());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Groups State
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  const [openedGroup, setOpenedGroup] = useState(null);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupProcessing, setIsGroupProcessing] = useState(false);

  // Expenses State
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState(null);
  const [isDeletingExpenseId, setIsDeletingExpenseId] = useState(null);

  // Modal Dialogs
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [addExpenseDefaultGroupId, setAddExpenseDefaultGroupId] = useState(null);
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false);
  const [settleUpPrefill, setSettleUpPrefill] = useState({
    groupId: null,
    sender: '',
    receiver: '',
    amount: '',
  });
  const [viewingExpense, setViewingExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // Fetch user's groups from Express
  const loadGroups = async (token = authToken) => {
    if (!token) {
      setGroups([]);
      return;
    }
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const list = await fetchMyGroups(token);
      setGroups(list);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setGroupsError(err.message || 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch all expenses
  const loadExpenses = async () => {
    setLoadingExpenses(true);
    setExpensesError(null);
    try {
      const list = await fetchExpenses({}, authToken);
      setExpenses(list);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
      setExpensesError(err.message || 'Failed to load expenses');
    } finally {
      setLoadingExpenses(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadExpenses();
    if (authToken) {
      loadGroups(authToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh groups when auth changes
  useEffect(() => {
    if (authToken) {
      loadGroups(authToken);
    } else {
      setGroups([]);
      setOpenedGroup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Auth Success
  const handleAuthSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
  };

  // Logout
  const handleLogout = async () => {
    await logoutApi();
    setCurrentUser(null);
    setAuthToken(null);
    setOpenedGroup(null);
    setGroups([]);
  };

  // Create Group
  const handleCreateGroup = async (groupData) => {
    if (!authToken) {
      setIsAuthModalOpen(true);
      throw new Error('Please log in to create a group');
    }

    const created = await createGroupApi(groupData, authToken);
    setGroups((prev) => [created, ...prev]);
    return created;
  };

  // Open Group Detail
  const handleOpenGroup = async (group) => {
    const groupId = group.id || group._id;
    try {
      const fullGroup = await fetchGroupById(groupId, authToken);
      setOpenedGroup(fullGroup);
      setActiveTab('groups');
    } catch (err) {
      alert(`Error opening group: ${err.message}`);
    }
  };

  // Add Member
  const handleAddMember = async (groupId, memberData) => {
    setIsGroupProcessing(true);
    try {
      const updated = await addMemberApi(groupId, memberData, authToken);
      setOpenedGroup(updated);
      setGroups((prev) => prev.map((g) => ((g.id || g._id) === groupId ? updated : g)));
    } finally {
      setIsGroupProcessing(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (groupId, memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) {
      return;
    }

    setIsGroupProcessing(true);
    try {
      const updated = await removeMemberApi(groupId, memberId, authToken);
      setOpenedGroup(updated);
      setGroups((prev) => prev.map((g) => ((g.id || g._id) === groupId ? updated : g)));
    } catch (err) {
      alert(`Error removing member: ${err.message}`);
    } finally {
      setIsGroupProcessing(false);
    }
  };

  // Update Group
  const handleUpdateGroup = async (groupId, groupData) => {
    setIsGroupProcessing(true);
    try {
      const updated = await updateGroupApi(groupId, groupData, authToken);
      setOpenedGroup(updated);
      setGroups((prev) => prev.map((g) => ((g.id || g._id) === groupId ? updated : g)));
    } finally {
      setIsGroupProcessing(false);
    }
  };

  // Add Expense
  const handleAddExpense = async (newExpenseData) => {
    const created = await createExpenseApi(newExpenseData, authToken);
    setExpenses((prev) => [created, ...prev]);
    return created;
  };

  // View Expense
  const handleViewExpense = (expense) => {
    setViewingExpense(expense);
  };

  // Edit Expense
  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
  };

  // Save Edit Expense
  const handleSaveEditExpense = async (id, updateData) => {
    const updated = await updateExpenseApi(id, updateData, authToken);
    setExpenses((prev) =>
      prev.map((item) => ((item.id || item._id) === id ? updated : item))
    );
    return updated;
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    setIsDeletingExpenseId(id);
    try {
      await deleteExpenseApi(id, authToken);
      setExpenses((prev) => prev.filter((item) => (item.id || item._id) !== id));
    } catch (err) {
      alert(`Error deleting expense: ${err.message}`);
    } finally {
      setIsDeletingExpenseId(null);
    }
  };

  // Open Add Expense modal
  const handleOpenAddExpense = (groupId = null) => {
    setAddExpenseDefaultGroupId(groupId);
    setIsAddExpenseModalOpen(true);
  };

  // Open Settle Up Modal with optional pre-filled transaction data
  const handleOpenSettleUpWithData = (data = {}) => {
    setSettleUpPrefill({
      groupId: data.groupId || (groups.length > 0 ? groups[0].id || groups[0]._id : null),
      sender: data.sender || '',
      receiver: data.receiver || '',
      amount: data.amount || '',
    });
    setIsSettleUpModalOpen(true);
  };

  // Refresh all backend data
  const handleRefreshAll = () => {
    loadExpenses();
    if (authToken) loadGroups(authToken);
  };

  // Filter expenses for opened group
  const openedGroupExpenses = openedGroup
    ? expenses.filter((e) => String(e.group) === String(openedGroup.id || openedGroup._id))
    : [];

  return (
    <div className="app-shell">
      {/* 1. Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'groups') setOpenedGroup(null);
        }}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenCreateGroupModal={() => {
          if (!currentUser) {
            setIsAuthModalOpen(true);
          } else {
            setIsCreateGroupModalOpen(true);
          }
        }}
        onOpenAddExpenseModal={() => handleOpenAddExpense(null)}
      />

      {/* 2. Main Content Area */}
      <main className="app-main-content">
        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <Dashboard
            currentUser={currentUser}
            groups={groups}
            expenses={expenses}
            loadingGroups={loadingGroups}
            loadingExpenses={loadingExpenses}
            groupsError={groupsError}
            expensesError={expensesError}
            onOpenGroup={handleOpenGroup}
            onOpenCreateGroupModal={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsCreateGroupModalOpen(true);
              }
            }}
            onOpenAddExpenseModal={() => handleOpenAddExpense(null)}
            onOpenSettleUpModal={() => handleOpenSettleUpWithData()}
            onRefresh={handleRefreshAll}
          />
        )}

        {/* Tab 2: Groups & Members View */}
        {activeTab === 'groups' && (
          <section className="view-container">
            {!currentUser ? (
              <div className="card auth-required-card">
                <h3>🔑 Authentication Required to Access Groups</h3>
                <p>Groups contain private financial data. Please sign in or create an account to view and manage your groups.</p>
                <button className="btn btn-primary" onClick={() => setIsAuthModalOpen(true)}>
                  Sign In or Register
                </button>
              </div>
            ) : openedGroup ? (
              <GroupDetail
                group={openedGroup}
                currentUser={currentUser}
                groupExpenses={openedGroupExpenses}
                onBack={() => setOpenedGroup(null)}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
                onUpdateGroup={handleUpdateGroup}
                onOpenAddExpense={(gId) => handleOpenAddExpense(gId)}
                onOpenSettleUp={() => handleOpenSettleUpWithData({ groupId: openedGroup.id || openedGroup._id })}
                isProcessing={isGroupProcessing}
              />
            ) : (
              <GroupList
                groups={groups}
                loading={loadingGroups}
                error={groupsError}
                onOpenGroup={handleOpenGroup}
                onCreateGroupClick={() => setIsCreateGroupModalOpen(true)}
                onRefresh={() => loadGroups(authToken)}
              />
            )}
          </section>
        )}

        {/* Tab 3: Expenses Management View */}
        {activeTab === 'expenses' && (
          <section className="view-container">
            {loadingExpenses ? (
              <div className="card loading-card">
                <div className="spinner"></div>
                <p>Loading expenses...</p>
              </div>
            ) : expensesError ? (
              <div className="card error-card">
                <p>Error loading expenses: {expensesError}</p>
                <button className="btn btn-primary" onClick={loadExpenses}>Retry</button>
              </div>
            ) : (
              <ExpenseList
                expenses={expenses}
                groups={groups}
                onOpenAddExpense={() => handleOpenAddExpense(null)}
                onViewExpense={handleViewExpense}
                onEditExpense={handleEditExpense}
                onDeleteExpense={handleDeleteExpense}
                isDeleting={isDeletingExpenseId}
              />
            )}
          </section>
        )}

        {/* Tab 4: Debt Settlement & Optimization View */}
        {activeTab === 'settlements' && (
          <section className="view-container">
            {!currentUser ? (
              <div className="card auth-required-card">
                <h3>🔑 Authentication Required</h3>
                <p>Please sign in to view group balances and settle debts.</p>
                <button className="btn btn-primary" onClick={() => setIsAuthModalOpen(true)}>
                  Sign In or Register
                </button>
              </div>
            ) : (
              <SettlementView
                groups={groups}
                currentUser={currentUser}
                authToken={authToken}
                onOpenSettleUpModalWithData={handleOpenSettleUpWithData}
              />
            )}
          </section>
        )}

        {/* Tab 5: Financial Activity Log */}
        {activeTab === 'activity' && (
          <section className="view-container">
            {!currentUser ? (
              <div className="card auth-required-card">
                <h3>🔑 Authentication Required</h3>
                <p>Please sign in to view recent activity for your groups.</p>
                <button className="btn btn-primary" onClick={() => setIsAuthModalOpen(true)}>
                  Sign In or Register
                </button>
              </div>
            ) : (
              <ActivityView
                groups={groups}
                authToken={authToken}
              />
            )}
          </section>
        )}

        {/* Tab 6: Financial Reports & CSV Export */}
        {activeTab === 'reports' && (
          <section className="view-container">
            {!currentUser ? (
              <div className="card auth-required-card">
                <h3>🔑 Authentication Required</h3>
                <p>Please sign in to view spending analytics and download CSV reports.</p>
                <button className="btn btn-primary" onClick={() => setIsAuthModalOpen(true)}>
                  Sign In or Register
                </button>
              </div>
            ) : (
              <ReportsView
                groups={groups}
                authToken={authToken}
              />
            )}
          </section>
        )}
      </main>

      {/* Global Modals */}
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onGroupCreated={handleCreateGroup}
        token={authToken}
      />

      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        groups={groups}
        currentUser={currentUser}
        defaultGroupId={addExpenseDefaultGroupId}
        onAddExpense={handleAddExpense}
      />

      {/* View Expense Modal */}
      <ViewExpenseModal
        isOpen={Boolean(viewingExpense)}
        onClose={() => setViewingExpense(null)}
        expense={viewingExpense}
        groupName={
          viewingExpense && viewingExpense.group
            ? groups.find((g) => String(g.id || g._id) === String(viewingExpense.group))?.name
            : null
        }
        onEditClick={(exp) => setEditingExpense(exp)}
        onDeleteClick={(id) => handleDeleteExpense(id)}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        groups={groups}
        currentUser={currentUser}
        onUpdateExpense={handleSaveEditExpense}
      />

      {/* Interactive Settle Up Modal */}
      <SettleUpModal
        isOpen={isSettleUpModalOpen}
        onClose={() => setIsSettleUpModalOpen(false)}
        groups={groups}
        currentUser={currentUser}
        authToken={authToken}
        defaultGroupId={settleUpPrefill.groupId}
        defaultSender={settleUpPrefill.sender}
        defaultReceiver={settleUpPrefill.receiver}
        defaultAmount={settleUpPrefill.amount}
        onPaymentSuccess={() => {
          handleRefreshAll();
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
