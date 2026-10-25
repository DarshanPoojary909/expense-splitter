/**
 * Settlement API Service (Frontend Client)
 * 
 * Communicates with backend endpoints:
 * - POST /api/settlements (Record payment)
 * - GET /api/settlements/group/:groupId (Payment history)
 * - GET /api/settlements/group/:groupId/balances (Net balances)
 * - GET /api/settlements/group/:groupId/optimized (Min-cash-flow algorithm)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Record a new settlement payment (full or partial)
 */
export async function createSettlementPaymentApi(paymentData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/settlements`, {
    method: 'POST',
    headers,
    body: JSON.stringify(paymentData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to record settlement payment');
  }

  return data.data;
}

/**
 * Fetch recorded settlement payments for a group
 */
export async function fetchGroupSettlements(groupId, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/settlements/group/${groupId}`, {
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch settlement payments');
  }

  return data.data || [];
}

/**
 * Fetch calculated net balances for a group
 */
export async function fetchGroupBalances(groupId, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/settlements/group/${groupId}/balances`, {
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch group balances');
  }

  return data.data;
}

/**
 * Fetch suggested optimized transactions for a group
 */
export async function fetchOptimizedSettlements(groupId, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/settlements/group/${groupId}/optimized`, {
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch optimized settlements');
  }

  return data.data;
}
