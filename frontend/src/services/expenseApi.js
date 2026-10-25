/**
 * Frontend Expense API Service (Day 8: Full CRUD + Authorization)
 * 
 * WHY AN API SERVICE LAYER IN REACT?
 * - Isolates network/fetch logic from React UI components.
 * - Centralizes endpoint paths, HTTP methods, headers (Bearer JWT tokens), and JSON parsing.
 * - Translates HTTP error responses into meaningful Error objects for UI components.
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Fetch backend health status (GET /api/health)
 */
export async function getHealthStatus() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch all expenses from backend (GET /api/expenses)
 * Supports optional group filter and category filter.
 */
export async function fetchExpenses(filter = {}, token = null) {
  const params = new URLSearchParams();
  if (filter.group) params.append('group', filter.group);
  if (filter.category) params.append('category', filter.category);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/expenses${queryString}`, { headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch expenses');
  }
  return data.data; // Array of expenses
}

/**
 * Fetch single expense by ID (GET /api/expenses/:id)
 */
export async function fetchExpenseByIdApi(id, token = null) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, { headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to fetch expense with ID: ${id}`);
  }
  return data.data;
}

/**
 * Create a new expense on backend (POST /api/expenses)
 */
export async function createExpenseApi(expenseData, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(expenseData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create expense');
  }
  return data.data; // Created expense
}

/**
 * Update an existing expense on backend (PUT /api/expenses/:id)
 */
export async function updateExpenseApi(id, updateData, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updateData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update expense');
  }
  return data.data; // Updated expense
}

/**
 * Delete an expense on backend (DELETE /api/expenses/:id)
 */
export async function deleteExpenseApi(id, token = null) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
    method: 'DELETE',
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete expense');
  }
  return data.data; // Deleted expense
}

