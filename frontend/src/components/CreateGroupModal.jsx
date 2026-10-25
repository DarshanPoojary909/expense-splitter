import { useState } from 'react';
import './CreateGroupModal.css';

const GROUP_TYPES = [
  { value: 'Trip', label: '✈️ Trip', desc: 'Vacation, road trip, weekend getaway' },
  { value: 'Home', label: '🏠 Home', desc: 'Flatmates, rent, household groceries' },
  { value: 'Couple', label: '💑 Couple', desc: 'Shared dining, dates, joint expenses' },
  { value: 'Project', label: '💻 Project', desc: 'Hackathon, startup, event planning' },
  { value: 'Other', label: '📁 Other', desc: 'General shared group' },
];

const CURRENCIES = ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD', 'JPY'];

function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('Trip');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [simplifyDebts, setSimplifyDebts] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onGroupCreated({
        name: name.trim(),
        description: description.trim(),
        groupType,
        baseCurrency,
        simplifyDebts,
      });

      // Reset form
      setName('');
      setDescription('');
      setGroupType('Trip');
      setBaseCurrency('USD');
      setSimplifyDebts(true);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>➕ Create New Group</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="group-form">
          <div className="form-group">
            <label htmlFor="groupName">Group Name *</label>
            <input
              id="groupName"
              type="text"
              placeholder="e.g. Goa Trip 2026, Apartment 4B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </div>

          <div className="form-group">
            <label htmlFor="groupDesc">Description (Optional)</label>
            <textarea
              id="groupDesc"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={250}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="groupType">Group Type</label>
              <select
                id="groupType"
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
              >
                {GROUP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="baseCurrency">Base Currency</label>
              <select
                id="baseCurrency"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={simplifyDebts}
                onChange={(e) => setSimplifyDebts(e.target.checked)}
              />
              <span>
                <strong>Simplify Group Debts (Recommended)</strong>
                <small>Automatically reduces the total number of transactions needed to settle up.</small>
              </span>
            </label>
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
              {loading ? 'Creating Group...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
