import { useState } from 'react';
import { registerApi, loginApi } from '../services/authApi';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    defaultCurrency: 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleTabSwitch = (loginMode) => {
    setIsLoginTab(loginMode);
    setErrorMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let result;
      if (isLoginTab) {
        // Log In
        result = await loginApi({
          email: formData.email,
          password: formData.password,
        });
      } else {
        // Register
        result = await registerApi({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          defaultCurrency: formData.defaultCurrency,
        });
      }

      onAuthSuccess(result.user, result.token);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isLoginTab ? '🔐 Account Login' : '📝 Create New Account'}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${isLoginTab ? 'active' : ''}`}
            onClick={() => handleTabSwitch(true)}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${!isLoginTab ? 'active' : ''}`}
            onClick={() => handleTabSwitch(false)}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="auth-error">{errorMessage}</div>}

          {!isLoginTab && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name *</label>
              <input
                id="auth-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Alice Johnson"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address *</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              placeholder="e.g. alice@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password (min 6 characters) *</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {!isLoginTab && (
            <div className="form-group">
              <label htmlFor="auth-currency">Default Currency</label>
              <select
                id="auth-currency"
                name="defaultCurrency"
                value={formData.defaultCurrency}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? 'Processing...'
              : isLoginTab
              ? 'Sign In'
              : 'Create Account'}
          </button>

          <div className="auth-footer-text">
            {isLoginTab ? (
              <span>
                Don't have an account?{' '}
                <button type="button" onClick={() => handleTabSwitch(false)}>
                  Register here
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button type="button" onClick={() => handleTabSwitch(true)}>
                  Sign In
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
