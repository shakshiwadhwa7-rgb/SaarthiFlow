// Reusable API Client for SaarthiFlow
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (networkErr) {
    throw new Error(`Cannot connect to SaarthiFlow backend at ${API_BASE}. Ensure the backend server is running.`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `API request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // Tasks
  getTasks: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'All') query.set('status', params.status);
    if (params.priority && params.priority !== 'All') query.set('priority', params.priority);
    if (params.project && params.project !== 'All') query.set('project', params.project);
    const qs = query.toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (task) => request('/tasks', { method: 'POST', body: task }),
  updateTask: (id, patch) => request(`/tasks/${id}`, { method: 'PATCH', body: patch }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: () => request('/projects'),
  createProject: (name) => request('/projects', { method: 'POST', body: { name } }),

  // Agent Planning & Runs
  generatePlan: ({ command, webpageUrl, webpageText }) => 
    request('/agent/plan', {
      method: 'POST',
      body: { command, webpageUrl, webpageText }
    }),
  getAgentRuns: () => request('/agent/runs'),

  // Action Proposals & Approvals
  getApprovals: (status) => {
    const qs = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/approvals${qs}`);
  },
  updateProposal: (id, patch) => request(`/approvals/${id}`, { method: 'PATCH', body: patch }),
  approveProposal: (id, tasks) => 
    request(`/approvals/${id}/approve`, {
      method: 'POST',
      body: { tasks }
    }),
  rejectProposal: (id) => 
    request(`/approvals/${id}/reject`, {
      method: 'POST'
    }),

  // Activity Logs
  getActivity: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'All') query.set('status', params.status);
    const qs = query.toString();
    return request(`/activity${qs ? `?${qs}` : ''}`);
  },

  // Analytics
  getAnalytics: () => request('/analytics'),

  // Settings
  getSettings: () => request('/settings'),
  saveSettings: (settings) => request('/settings', { method: 'POST', body: settings })
};
