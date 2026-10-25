import { useState, useEffect } from 'react';
import './AddExpenseModal.css';

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

const SPLIT_TYPES = [
  { id: 'EQUAL', label: 'Equal (=)', icon: '⚖️', desc: 'Split equally among all participants' },
  { id: 'EXACT', label: 'Exact ($)', icon: '💵', desc: 'Specify exact dollar amount per person' },
  { id: 'PERCENTAGE', label: 'Percentage (%)', icon: '📊', desc: 'Specify percentage share (totals 100%)' },
  { id: 'SHARES', label: 'Shares (1x, 2x)', icon: '📈', desc: 'Split proportionally based on weighted shares' },
];

/**
 * AddExpenseModal Component (Days 8-9: Four Split Methods & Multi-Payer Support)
 */
function AddExpenseModal({
  isOpen,
  onClose,
  groups = [],
  currentUser,
  defaultGroupId = null,
  onAddExpense,
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId || '');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('EQUAL');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Participant split inputs state: map of memberName -> { amountOwed, percentage, shares, included }
  const [participantSplits, setParticipantSplits] = useState({});

  // Multiple Payers state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [payerContributions, setPayerContributions] = useState({});

  // Sync selected group, default payer, and participant list when modal opens
  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroupId(defaultGroupId);
    } else if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id || groups[0]._id);
    }

    if (currentUser?.name && !paidBy) {
      setPaidBy(currentUser.name);
    }
  }, [isOpen, defaultGroupId, groups, currentUser, selectedGroupId, paidBy]);

  const currentGroup = groups.find((g) => (g.id || g._id) === selectedGroupId);
  const groupMembers = currentGroup?.members || [];
  const memberNames = groupMembers.length > 0
    ? groupMembers.map((m) => m.name)
    : [paidBy || currentUser?.name || 'User'];

  // Initialize participant splits map whenever members or splitType changes
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    const initialSplits = {};
    const initialPayers = {};

    memberNames.forEach((name) => {
      initialSplits[name] = {
        name,
        amountOwed: numAmount > 0 ? (numAmount / memberNames.length).toFixed(2) : '0.00',
        percentage: (100 / (memberNames.length || 1)).toFixed(1),
        shares: '1',
        included: true,
      };
      initialPayers[name] = name === paidBy ? numAmount.toFixed(2) : '0.00';
    });

    setParticipantSplits(initialSplits);
    setPayerContributions(initialPayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groupMembers.length]);

  if (!isOpen) return null;

  const handleSplitValueChange = (name, field, val) => {
    setParticipantSplits((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: val,
      },
    }));
  };

  const handlePayerChange = (name, val) => {
    setPayerContributions((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter an expense title/description.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const payerName = paidBy.trim() || currentUser?.name || 'Primary User';

    // Construct payers
    let payersPayload = [];
    if (isMultiPayer) {
      let sumPayers = 0;
      payersPayload = memberNames
        .map((name) => {
          const val = parseFloat(payerContributions[name]) || 0;
          sumPayers += val;
          return { name, amount: val };
        })
        .filter((p) => p.amount > 0);

      if (Math.abs(sumPayers - numAmount) > 0.01) {
        setError(`Total payer contributions ($${sumPayers.toFixed(2)}) must equal total expense amount ($${numAmount.toFixed(2)}). Difference: $${Math.abs(sumPayers - numAmount).toFixed(2)}`);
        return;
      }
    } else {
      payersPayload = [{ name: payerName, amount: numAmount }];
    }

    // Construct splits
    const includedMembers = memberNames.filter(
      (name) => participantSplits[name]?.included !== false
    );

    if (includedMembers.length === 0) {
      setError('At least one participant must be included in the expense split.');
      return;
    }

    let splitsPayload = [];
    if (splitType === 'EXACT') {
      let sumExact = 0;
      splitsPayload = includedMembers.map((name) => {
        const val = parseFloat(participantSplits[name]?.amountOwed) || 0;
        sumExact += val;
        return { name, amountOwed: val };
      });
      if (Math.abs(sumExact - numAmount) > 0.01) {
        setError(`Exact splits sum ($${sumExact.toFixed(2)}) must equal total expense amount ($${numAmount.toFixed(2)}).`);
        return;
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      splitsPayload = includedMembers.map((name) => {
        const val = parseFloat(participantSplits[name]?.percentage) || 0;
        sumPct += val;
        return { name, percentage: val };
      });
      if (Math.abs(sumPct - 100) > 0.01) {
        setError(`Percentages must total exactly 100%. Currently totals ${sumPct.toFixed(1)}%.`);
        return;
      }
    } else if (splitType === 'SHARES') {
      let totalShares = 0;
      splitsPayload = includedMembers.map((name) => {
        const val = parseInt(participantSplits[name]?.shares, 10) || 1;
        totalShares += val;
        return { name, shares: val };
      });
      if (totalShares <= 0) {
        setError('Total shares must be greater than 0.');
        return;
      }
    } else {
      // EQUAL
      splitsPayload = includedMembers.map((name) => ({
        name,
        amountOwed: numAmount / includedMembers.length,
      }));
    }

    const expensePayload = {
      title: title.trim(),
      amount: numAmount,
      currency: currentGroup?.baseCurrency || currentUser?.defaultCurrency || 'USD',
      category,
      group: selectedGroupId || null,
      paidBy: payerName,
      payers: payersPayload,
      splitType,
      splits: splitsPayload,
      participants: includedMembers,
      expenseDate: new Date(expenseDate).toISOString(),
      notes: notes.trim(),
    };

    setLoading(true);
    try {
      await onAddExpense(expensePayload);
      // Reset form
      setTitle('');
      setAmount('');
      setCategory('Food & Dining');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-expense-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2>➕ Add New Expense</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="expense-form-modal">
          {/* Title */}
          <div className="form-group">
            <label htmlFor="expense-title">Expense Title / Description *</label>
            <input
              id="expense-title"
              type="text"
              placeholder="e.g., Team Dinner, Grocery run, Flight tickets"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              disabled={loading}
            />
          </div>

          {/* Amount & Category */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expense-amount">Total Amount ({currentGroup?.baseCurrency || 'USD'}) *</label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="expense-category">Category</label>
              <select
                id="expense-category"
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
          </div>

          {/* Group & Primary Payer */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expense-group">Select Group</label>
              <select
                id="expense-group"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- No Group (Individual) --</option>
                {groups.map((grp) => (
                  <option key={grp.id || grp._id} value={grp.id || grp._id}>
                    {grp.name} ({grp.groupType || 'Group'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="expense-payer">Paid By *</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setIsMultiPayer(!isMultiPayer)}
                >
                  {isMultiPayer ? 'Single Payer' : 'Multiple Payers?'}
                </button>
              </div>

              {!isMultiPayer ? (
                groupMembers.length > 0 ? (
                  <select
                    id="expense-payer"
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
                    id="expense-payer"
                    type="text"
                    placeholder="Payer name"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    required
                    disabled={loading}
                  />
                )
              ) : (
                <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <span>Multiple Payers Active (specify below)</span>
                </div>
              )}
            </div>
          </div>

          {/* Multiple Payers Input Grid (if enabled) */}
          {isMultiPayer && (
            <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px' }}>
              <strong style={{ fontSize: '0.85rem', color: '#334155' }}>Payer Contributions ($):</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                {memberNames.map((name) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.85rem', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payerContributions[name] || ''}
                      onChange={(e) => handlePayerChange(name, e.target.value)}
                      placeholder="0.00"
                      style={{ padding: '4px 8px', width: '90px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day 9: Four Splitting Methods Selector */}
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label>Splitting Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
              {SPLIT_TYPES.map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setSplitType(st.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '6px',
                    border: splitType === st.id ? '2px solid #6366f1' : '1px solid #cbd5e1',
                    background: splitType === st.id ? '#eef2ff' : '#ffffff',
                    color: splitType === st.id ? '#4338ca' : '#475569',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: splitType === st.id ? '600' : 'normal',
                    textAlign: 'center',
                  }}
                  title={st.desc}
                >
                  <div>{st.icon}</div>
                  <div>{st.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Participant Splits Input Table */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
              <span>Participant</span>
              <span>
                {splitType === 'EQUAL' && 'Included in split?'}
                {splitType === 'EXACT' && 'Amount Owed ($)'}
                {splitType === 'PERCENTAGE' && 'Percentage (%)'}
                {splitType === 'SHARES' && 'Shares Count'}
              </span>
            </div>

            {memberNames.map((name) => {
              const current = participantSplits[name] || {};
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={current.included !== false}
                      onChange={(e) => handleSplitValueChange(name, 'included', e.target.checked)}
                    />
                    <span>{name} {currentUser?.name === name ? '(You)' : ''}</span>
                  </label>

                  {splitType === 'EXACT' && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={current.amountOwed || ''}
                      onChange={(e) => handleSplitValueChange(name, 'amountOwed', e.target.value)}
                      placeholder="0.00"
                      style={{ padding: '4px 8px', width: '90px', textAlign: 'right' }}
                      disabled={current.included === false}
                    />
                  )}

                  {splitType === 'PERCENTAGE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={current.percentage || ''}
                        onChange={(e) => handleSplitValueChange(name, 'percentage', e.target.value)}
                        placeholder="0"
                        style={{ padding: '4px 8px', width: '70px', textAlign: 'right' }}
                        disabled={current.included === false}
                      />
                      <span>%</span>
                    </div>
                  )}

                  {splitType === 'SHARES' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={current.shares || '1'}
                        onChange={(e) => handleSplitValueChange(name, 'shares', e.target.value)}
                        placeholder="1"
                        style={{ padding: '4px 8px', width: '70px', textAlign: 'right' }}
                        disabled={current.included === false}
                      />
                      <span>share(s)</span>
                    </div>
                  )}

                  {splitType === 'EQUAL' && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {current.included !== false ? 'Equal share' : 'Excluded'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Date & Notes */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expense-date">Expense Date</label>
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="expense-notes">Notes (Optional)</label>
              <input
                id="expense-notes"
                type="text"
                placeholder="Receipt info, memo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
              />
            </div>
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
              {loading ? 'Submitting to Backend...' : '💾 Save Expense (POST)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddExpenseModal;
