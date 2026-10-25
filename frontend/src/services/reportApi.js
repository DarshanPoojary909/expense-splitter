/**
 * Reports & CSV Export API Service (Frontend Client)
 * 
 * Communicates with backend endpoints:
 * - GET /api/reports/group/:groupId (JSON Report)
 * - GET /api/reports/group/:groupId/csv (Direct CSV File Download)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch comprehensive financial report for a group
 */
export async function fetchGroupReport(groupId, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/reports/group/${groupId}`, {
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch financial report');
  }

  return data.data;
}

/**
 * Download CSV report directly in the browser
 */
export async function downloadGroupReportCsv(groupId, token, groupName = 'group') {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/reports/group/${groupId}/csv`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download CSV report');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = groupName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
  a.download = `expense_report_${safeName}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
