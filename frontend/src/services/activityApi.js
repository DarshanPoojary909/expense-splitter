/**
 * Activity Log API Service (Frontend Client)
 * 
 * Communicates with backend endpoints:
 * - GET /api/activity (User activity across all groups)
 * - GET /api/activity/group/:groupId (Group-specific activity)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all activity logs for current authenticated user
 */
export async function fetchUserActivity(token, limit = 50) {
  if (!token) return [];

  const response = await fetch(`${API_BASE_URL}/activity?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch activity logs');
  }

  return data.data || [];
}

/**
 * Fetch activity logs for a specific group
 */
export async function fetchGroupActivity(groupId, token, limit = 50) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/activity/group/${groupId}?limit=${limit}`, {
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch group activity');
  }

  return data.data || [];
}
