/**
 * Frontend Authentication API Service
 * 
 * WHY AN AUTH API SERVICE?
 * - Centralizes HTTP communication with the Express auth endpoints (/api/auth).
 * - Manages JWT token persistence in browser `localStorage`.
 * - Attaches `Authorization: Bearer <token>` header to protected requests.
 */

const API_BASE_URL = 'http://localhost:5000/api/auth';
const TOKEN_STORAGE_KEY = 'expense_splitter_jwt_token';
const USER_STORAGE_KEY = 'expense_splitter_user_profile';

/**
 * Get stored JWT token from localStorage
 */
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to read token from localStorage:', err);
    return null;
  }
}

/**
 * Store JWT token in localStorage
 */
export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to set token in localStorage:', err);
  }
}

/**
 * Get stored user profile from localStorage
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to parse user profile from localStorage:', err);
    return null;
  }
}

/**
 * Store user profile in localStorage
 */
export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to set user in localStorage:', err);
  }
}

/**
 * Clear all auth session data (Token + User)
 */
export function clearAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Register a new account
 * @param {Object} userData - { name, email, password, defaultCurrency }
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function registerApi(userData) {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'Registration failed');
  }

  const { user, token } = body.data;
  setStoredToken(token);
  setStoredUser(user);

  return { user, token };
}

/**
 * Log in with existing credentials
 * @param {Object} credentials - { email, password }
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function loginApi(credentials) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'Login failed');
  }

  const { user, token } = body.data;
  setStoredToken(token);
  setStoredUser(user);

  return { user, token };
}

/**
 * Fetch current user profile (Protected route: GET /api/auth/me)
 * @param {string} [tokenOverride] - Optional token to test manual/tampered tokens
 * @returns {Promise<Object>} User profile object
 */
export async function fetchMeApi(tokenOverride) {
  const token = tokenOverride !== undefined ? tokenOverride : getStoredToken();

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'GET',
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}: Failed to fetch profile`);
  }

  return body.data;
}

/**
 * Log out user (Notifies backend + clears local token)
 */
export async function logoutApi() {
  try {
    await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
    });
  } catch (err) {
    console.warn('Logout notification to backend failed:', err.message);
  } finally {
    clearAuthSession();
  }
}
