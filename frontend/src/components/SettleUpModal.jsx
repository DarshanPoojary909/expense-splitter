import { useState, useEffect } from 'react';
import './SettleUpModal.css';
import { createSettlementPaymentApi } from '../services/settlementApi';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Venmo', 'PayPal', 'Other'];

/**
 * SettleUpModal Component (Day 12: Settlement Payment & Partial Settle Up)
 */
function SettleUpModal({
  isOpen,
  onClose,
  groups = [],
  currentUser,
  authToken,
  defaultGroupId = null,
  defaultSender = '',
  defaultReceiver = '',
  defaultAmount = '',
  onPaymentSuccess,
}) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [originalAmount, setOriginalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or prefill state when modal opens
  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroupId(defaultGroupId);
    } else if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id || groups[0]._id);
    }

    if (defaultSender) setSender(defaultSender);
    if (defaultReceiver) setReceiver(defaultReceiver);
    if (defaultAmount) {
      setAmount(defaultAmount);
      setOriginalAmount(defaultAmount);
    }
  }, [isOpen, defaultGroupId, defaultSender, defaultReceiver, defaultAmount, groups, selectedGroupId]);

  if (!isOpen) return null;

  const currentGroup = groups.find((g) => (g.id || g._id) === selectedGroupId);
  const members = currentGroup?.members || [];

  const handleGroupChange = (e) => {
    const gId = e.target.value;
    setSelectedGroupId(gId);
    const grp = groups.find((g) => (g.id || g._id) === gId);
    if (grp && grp.members && grp.members.length >= 2) {
      setSender(grp.members[0].name);
      setReceiver(grp.members[1].name);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const parsedOriginal = parseFloat(originalAmount) || parsedAmount;
  const remaining = isPartial && parsedOriginal > parsedAmount ? (parsedOriginal - parsedAmount).toFixed(2) : '0.00';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedGroupId) {
      setError('Please select a group for this settlement.');
      return;
    }

    if (!sender.trim() || !receiver.trim()) {
      setError('Please select both the sender (payer) and receiver (payee).');
      return;
    }

    if (sender.trim().toLowerCase() === receiver.trim().toLowerCase()) {
      setError('Sender and receiver cannot be the same person.');
      return;
    }

    if (parsedAmount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }

    const payload = {
      group: selectedGroupId,
      senderName: sender.trim(),
      receiverName: receiver.trim(),
      amount: parsedAmount,
      currency: currentGroup?.baseCurrency || 'USD',
      paymentMethod,
      paymentDate: new Date(paymentDate).toISOString(),
      notes: notes.trim(),
      originalAmount: isPartial && parsedOriginal > parsedAmount ? parsedOriginal : parsedAmount,
    };

    setLoading(true);
    try {
      const recorded = await createSettlementPaymentApi(payload, authToken);
      if (onPaymentSuccess) {
        onPaymentSuccess(recorded);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record settlement payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settle-up-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="settle-header-title">
            <span className="settle-icon">🤝</span>
            <h2>Record Settlement Payment</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="settle-form">
          {/* Select Group */}
          <div className="form-group">
            <label htmlFor="settle-group">Select Group *</label>
            <select
              id="settle-group"
              value={selectedGroupId}
              onChange={handleGroupChange}
              disabled={loading}
              required
            >
              <option value="">-- Choose Group --</option>
              {groups.map((grp) => (
                <option key={grp.id || grp._id} value={grp.id || grp._id}>
                  {grp.name} ({grp.baseCurrency || 'USD'})
                </option>
              ))}
            </select>
          </div>

          {/* Sender & Receiver Grid */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="settle-sender">Who Paid? (Debtor) *</label>
              {members.length > 0 ? (
                <select
                  id="settle-sender"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  disabled={loading}
                  required
                >
                  <option value="">-- Select Sender --</option>
                  {members.map((m) => (
                    <option key={m._id || m.userId || m.name} value={m.name}>
                      {m.name} {currentUser?.name === m.name ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="settle-sender"
                  type="text"
                  placeholder="Sender name"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  disabled={loading}
                  required
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="settle-receiver">Who Received? (Creditor) *</label>
              {members.length > 0 ? (
                <select
                  id="settle-receiver"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  disabled={loading}
                  required
                >
                  <option value="">-- Select Receiver --</option>
                  {members.map((m) => (
                    <option key={m._id || m.userId || m.name} value={m.name}>
                      {m.name} {currentUser?.name === m.name ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="settle-receiver"
                  type="text"
                  placeholder="Receiver name"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  disabled={loading}
                  required
                />
              )}
            </div>
          </div>

          {/* Amount & Payment Method */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="settle-amount">Amount Paid ({currentGroup?.baseCurrency || 'USD'}) *</label>
              <input
                id="settle-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="settle-method">Payment Method</label>
              <select
                id="settle-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={loading}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Partial Settlement Options */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '500', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={isPartial}
                onChange={(e) => {
                  setIsPartial(e.target.checked);
                  if (e.target.checked && !originalAmount) {
                    setOriginalAmount(amount);
                  }
                }}
              />
              <span>Is this a Partial Settlement? (Paying part of a larger debt)</span>
            </label>

            {isPartial && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Original Debt ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    placeholder="Total debt"
                    style={{ padding: '4px 8px', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Remaining Debt After Payment:</label>
                  <div style={{ padding: '6px 8px', background: '#e2e8f0', borderRadius: '4px', fontWeight: 'bold', color: '#334155' }}>
                    ${remaining}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date & Notes */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="settle-date">Payment Date</label>
              <input
                id="settle-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="settle-notes">Notes / Memo (Optional)</label>
              <input
                id="settle-notes"
                type="text"
                placeholder="UPI ref, note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
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
              {loading ? 'Recording Payment...' : '🤝 Confirm Settle Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettleUpModal;
