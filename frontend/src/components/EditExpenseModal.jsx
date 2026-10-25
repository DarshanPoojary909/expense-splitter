import { useState, useEffect } from 'react';
import './EditExpenseModal.css';

const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Accommodation',
  'Entertainment',
  'Utilities',
  'Shopping',
  'General',
];

/**
 * EditExpenseModal Component (Day 8: Edit Expense with PUT /api/expenses/:id)
 * 
 * WHY THIS MODAL?
 * - Allows modifying existing expense records with full client-side and server-side validation.
 * - Dynamically updates payers list and group association.
 * - Handles optimistic or stateful updates upon HTTP 200 response from backend.
 */
function EditExpenseModal({ isOpen, onClose, expense, groups = [], currentUser, onUpdateExpense }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [currency, setCurrency] = useState('USD');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill form fields when modal opens with active expense
  useEffect(() => {
    if (expense) {
      setTitle(expense.title || '');
      setAmount(String(expense.amount || ''));
      setCategory(expense.category || 'Food & Dining');
      setCurrency(expense.currency || 'USD');
      setSelectedGroupId(expense.group ? String(expense.group) : '');
      setPaidBy(expense.paidBy || '');
      if (expense.expenseDate) {
        try {
          const d = new Date(expense.expenseDate);
          setExpenseDate(d.toISOString().split('T')[0]);
        } catch {
          setExpenseDate(new Date().toISOString().split('T')[0]);
        }
      } else {
        setExpenseDate(new Date().toISOString().split('T')[0]);
      }
      setNotes(expense.notes || '');
      setError(null);
    }
  }, [expense, isOpen]);

  if (!isOpen || !expense) return null;

  const currentGroup = groups.find((g) => String(g.id || g._id) === String(selectedGroupId));
  const groupMembers = currentGroup?.members || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!title.trim()) {
      setError('Title/description is required.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number greater than 0.');
      return;
    }

    if (!paidBy.trim()) {
      setError('Payer name is required.');
      return;
    }

    if (!expenseDate) {
      setError('Expense date is required.');
      return;
    }

    const rawId = expense.id || expense._id;
    const updatePayload = {
      title: title.trim(),
      amount: numAmount,
      currency: currency.toUpperCase().trim(),
      category,
      group: selectedGroupId || null,
      paidBy: paidBy.trim(),
      expenseDate: new Date(expenseDate).toISOString(),
      notes: notes.trim(),
    };

    setLoading(true);
    try {
      await onUpdateExpense(rawId, updatePayload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update expense on backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-expense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Expense</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && (
          <div className="modal-error-banner" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-expense-form">
          <div className="form-group">
            <label htmlFor="edit-expense-title">Expense Title / Description *</label>
            <input
              id="edit-expense-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-expense-amount">Amount *</label>
              <input
                id="edit-expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-expense-currency">Currency</label>
              <select
                id="edit-expense-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-expense-category">Category</label>
              <select
                id="edit-expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-expense-group">Group</label>
              <select
                id="edit-expense-group"
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  const grp = groups.find((g) => String(g.id || g._id) === e.target.value);
                  if (grp && grp.members && grp.members.length > 0) {
                    setPaidBy(grp.members[0].name);
                  }
                }}
                disabled={loading}
              >
                <option value="">-- No Group (Individual Expense) --</option>
                {groups.map((grp) => (
                  <option key={grp.id || grp._id} value={grp.id || grp._id}>
                    {grp.name} ({grp.groupType || 'Group'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-expense-payer">Paid By *</label>
              {groupMembers.length > 0 ? (
                <select
                  id="edit-expense-payer"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  disabled={loading}
                >
                  {groupMembers.map((m) => (
                    <option key={m._id || m.userId || m.name} value={m.name}>
                      {m.name} {currentUser?.name === m.name ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="edit-expense-payer"
                  type="text"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                  disabled={loading}
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="edit-expense-date">Expense Date *</label>
              <input
                id="edit-expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-expense-notes">Notes (Optional)</label>
            <input
              id="edit-expense-notes"
              type="text"
              placeholder="Memo, details, receipt number..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving Changes via PUT...' : '💾 Update Expense (PUT)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditExpenseModal;
