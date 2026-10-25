/**
 * Group API Service (Frontend HTTP Client)
 * 
 * WHY A GROUP API SERVICE?
 * - Centralizes all HTTP/REST calls to `/api/groups` endpoints.
 * - Attaches `Authorization: Bearer <token>` header to authenticate each request.
 * - Extracts and returns JSON data or throws standard error objects.
 */

const API_BASE_URL = 'http://localhost:5000/api/groups';

/**
 * Fetch all groups that the authenticated user is a member of
 * @param {string} token - JWT Token
 * @returns {Promise<Array>} List of groups
 */
export async function fetchMyGroups(token) {
  const response = await fetch(API_BASE_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}: Failed to fetch groups`);
  }

  return body.data;
}

/**
 * Fetch a single group by ID (Open group)
 * @param {string} groupId 
 * @param {string} token 
 * @returns {Promise<Object>} Group document with embedded members
 */
export async function fetchGroupById(groupId, token) {
  const response = await fetch(`${API_BASE_URL}/${groupId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}: Failed to open group`);
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Create a new group
 * @param {Object} groupData - { name, description, groupType, baseCurrency, simplifyDebts }
 * @param {string} token 
 * @returns {Promise<Object>} Created group
 */
export async function createGroupApi(groupData, token) {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(groupData),
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}: Failed to create group`);
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Update group settings
 * @param {string} groupId 
 * @param {Object} groupData 
 * @param {string} token 
 * @returns {Promise<Object>} Updated group
 */
export async function updateGroupApi(groupId, groupData, token) {
  const response = await fetch(`${API_BASE_URL}/${groupId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(groupData),
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}: Failed to update group`);
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Fetch group members
 * @param {string} groupId 
 * @param {string} token 
 * @returns {Promise<Array>} Embedded members list
 */
export async function fetchGroupMembers(groupId, token) {
  const response = await fetch(`${API_BASE_URL}/${groupId}/members`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}: Failed to fetch members`);
  }

  return body.data;
}

/**
 * Add a member to group's embedded members array
 * @param {string} groupId 
 * @param {Object} memberData - { email, name, role }
 * @param {string} token 
 * @returns {Promise<Object>} Updated group
 */
export async function addMemberApi(groupId, memberData, token) {
  const response = await fetch(`${API_BASE_URL}/${groupId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(memberData),
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}: Failed to add member`);
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Remove a member from group
 * @param {string} groupId 
 * @param {string} memberId 
 * @param {string} token 
 * @returns {Promise<Object>} Updated group
 */
export async function removeMemberApi(groupId, memberId, token) {
  const response = await fetch(`${API_BASE_URL}/${groupId}/members/${memberId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}: Failed to remove member`);
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}
