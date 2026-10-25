import { useState, useMemo } from 'react';
import './ExpenseList.css';

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
 * ExpenseList Component (Day 8: Full CRUD Controls & Search/Filter)
 * 
 * Demonstrates:
 * 1. Filtering & Search: Multi-criteria filtering by category, group, and text search.
 * 2. Full Action Suite: View Details (Modal + Compass JSON), Edit (PUT), Delete (DELETE).
 * 3. Reactive Summary: Live calculation of visible expense counts and totals.
 */
function ExpenseList({
  expenses = [],
  groups = [],
  onOpenAddExpense,
  onViewExpense,
  onEditExpense,
  onDeleteExpense,
  isDeleting,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');

  // Create a map of groupId -> groupName for fast lookup
  const groupMap = useMemo(() => {
    const map = {};
    for (const g of groups) {
      map[String(g.id || g._id)] = g.name;
    }
    return map;
  }, [groups]);

  // Filter expenses based on search term, category, and group
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // 1. Text Search (title, paidBy, notes)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesTitle = exp.title?.toLowerCase().includes(term);
        const matchesPayer = exp.paidBy?.toLowerCase().includes(term);
        const matchesNotes = exp.notes?.toLowerCase().includes(term);
        if (!matchesTitle && !matchesPayer && !matchesNotes) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'ALL' && exp.category !== categoryFilter) {
        return false;
      }

      // 3. Group Filter
      if (groupFilter !== 'ALL') {
        if (groupFilter === 'NONE' && exp.group) return false;
        if (groupFilter !== 'NONE' && String(exp.group) !== String(groupFilter)) return false;
      }

      return true;
    });
  }, [expenses, searchTerm, categoryFilter, groupFilter]);

  // Total visible amount
  const visibleTotal = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="expense-list-container">
      {/* Header & Controls Bar */}
      <div className="expense-list-header">
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>🧾 All Expenses ({filteredExpenses.length})</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Total filtered amount: <strong style={{ color: '#2563eb' }}>${visibleTotal.toFixed(2)}</strong>
          </span>
        </div>

        <div className="expense-header-actions">
          {onOpenAddExpense && (
            <button className="btn btn-primary" onClick={onOpenAddExpense}>
              ➕ Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="expense-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search expenses by title, payer, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by category"
          >
            <option value="ALL">📁 All Categories</option>
            <option value="Food & Dining">🍔 Food &amp; Dining</option>
            <option value="Groceries">🛒 Groceries</option>
            <option value="Transportation">🚗 Transportation</option>
            <option value="Accommodation">🏨 Accommodation</option>
            <option value="Entertainment">🎬 Entertainment</option>
            <option value="Utilities">💡 Utilities</option>
            <option value="Shopping">🛍️ Shopping</option>
            <option value="General">🧾 General</option>
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by group"
          >
            <option value="ALL">👥 All Groups</option>
            <option value="NONE">👤 Individual (No Group)</option>
            {groups.map((grp) => (
              <option key={grp.id || grp._id} value={grp.id || grp._id}>
                {grp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredExpenses.length === 0 ? (
        <div className="expense-list-empty">
          <p>
            {expenses.length === 0
              ? 'No expenses recorded yet. Click "+ Add Expense" to record your first expense.'
              : 'No expenses match the current search or filter criteria.'}
          </p>
          {(searchTerm || categoryFilter !== 'ALL' || groupFilter !== 'ALL') && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setGroupFilter('ALL');
              }}
              style={{ marginTop: '8px', fontSize: '0.85rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="expense-items">
          {filteredExpenses.map((expense) => {
            const rawId = expense.id || expense._id;
            const categoryIcon = CATEGORY_ICONS[expense.category] || '🧾';
            const groupName = expense.group ? (groupMap[String(expense.group)] || 'Group') : null;
            const formattedDate = expense.expenseDate
              ? new Date(expense.expenseDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent';

            return (
              <div key={rawId} className="expense-item-card">
                <div className="expense-left-side">
                  <div className="expense-item-icon-badge">{categoryIcon}</div>

                  <div className="expense-info">
                    <div className="expense-title-row">
                      <span className="expense-title">{expense.title}</span>
                      <span className="expense-category-tag">{expense.category || 'General'}</span>
                      {groupName && <span className="expense-group-tag">👥 {groupName}</span>}
                    </div>

                    <div className="expense-meta-row">
                      <span>Paid by <strong>{expense.paidBy}</strong></span>
                      <span>&bull;</span>
                      <span>📅 {formattedDate}</span>
                      <span>&bull;</span>
                      <span>Split: <em>{expense.splitType || 'EQUAL'}</em></span>
                      {expense.notes && (
                        <>
                          <span>&bull;</span>
                          <span className="expense-notes-snippet" title={expense.notes}>
                            📝 {expense.notes}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="expense-right-side">
                  <div className="expense-amount-display">
                    <span className="expense-curr">{expense.currency || 'USD'}</span>
                    ${Number(expense.amount).toFixed(2)}
                  </div>

                  {/* Action Buttons: View, Edit, Delete */}
                  <div className="expense-actions-bar">
                    {onViewExpense && (
                      <button
                        type="button"
                        onClick={() => onViewExpense(expense)}
                        className="btn-action btn-view"
                        title="View details"
                      >
                        👁️ View
                      </button>
                    )}

                    {onEditExpense && (
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="btn-action btn-edit"
                        title="Edit expense"
                      >
                        ✏️ Edit
                      </button>
                    )}

                    {onDeleteExpense && (
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(rawId)}
                        className="btn-action btn-delete"
                        disabled={isDeleting === rawId}
                        title="Delete expense"
                      >
                        {isDeleting === rawId ? '...' : '🗑️'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExpenseList;

