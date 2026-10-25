import './ViewExpenseModal.css';

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
 * ViewExpenseModal Component
 * - Displays receipt details, split breakdown, and payer info.
 */
function ViewExpenseModal({ isOpen, onClose, expense, groupName, onEditClick, onDeleteClick }) {
  if (!isOpen || !expense) return null;

  const categoryIcon = CATEGORY_ICONS[expense.category] || '🧾';
  const rawId = expense._id || expense.id;
  const formattedDate = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not specified';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-expense-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="view-modal-title-row">
            <span className="view-category-icon">{categoryIcon}</span>
            <div>
              <h2>{expense.title}</h2>
              <span className="view-date-subtitle">📅 {formattedDate}</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="view-details-body">
          {/* Hero Amount Banner */}
          <div className="view-amount-hero">
            <span className="view-currency-label">{expense.currency || 'USD'}</span>
            <span className="view-amount-val">${Number(expense.amount).toFixed(2)}</span>
          </div>

          {/* Details Grid */}
          <div className="view-grid">
            <div className="view-grid-item">
              <span className="view-label">Category</span>
              <span className="view-value category-pill">
                {categoryIcon} {expense.category || 'General'}
              </span>
            </div>

            <div className="view-grid-item">
              <span className="view-label">Group</span>
              <span className="view-value">
                {groupName || (expense.group ? 'Group Expense' : 'Individual Expense (No Group)')}
              </span>
            </div>

            <div className="view-grid-item">
              <span className="view-label">Primary Payer</span>
              <span className="view-value payer-highlight">
                👤 <strong>{expense.paidBy}</strong>
              </span>
            </div>

            <div className="view-grid-item">
              <span className="view-label">Split Strategy</span>
              <span className="view-value">
                <span className="split-badge">{expense.splitType || 'EQUAL'}</span>
              </span>
            </div>
          </div>

          {/* Participants */}
          <div className="view-section-box">
            <h4>👥 Participants ({expense.participants?.length || 1})</h4>
            <p className="view-participants-text">
              {(expense.participants && expense.participants.length > 0)
                ? expense.participants.join(', ')
                : expense.paidBy}
            </p>
          </div>

          {/* Payers Breakdown (if multiple payers) */}
          {expense.payers && expense.payers.length > 1 && (
            <div className="view-section-box">
              <h4>💳 Payer Breakdown ({expense.payers.length})</h4>
              <div className="view-payers-list">
                {expense.payers.map((p, idx) => (
                  <div key={idx} className="view-payer-row">
                    <span>👤 {p.name}</span>
                    <strong>${Number(p.amount).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {expense.notes && (
            <div className="view-section-box">
              <h4>📝 Notes</h4>
              <p className="view-notes-text">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-actions view-modal-actions">
          {onEditClick && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEditClick(expense);
              }}
            >
              ✏️ Edit
            </button>
          )}
          {onDeleteClick && (
            <button
              type="button"
              className="btn"
              style={{ background: '#ef4444', color: '#ffffff' }}
              onClick={() => {
                onClose();
                onDeleteClick(rawId);
              }}
            >
              🗑️ Delete
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewExpenseModal;
