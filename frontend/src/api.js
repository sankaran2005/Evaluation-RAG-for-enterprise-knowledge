const BASE_URL = '';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('rag_token');
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const err = await response.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch (e) {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Stats & Health
  getStats: () => request('/api/stats'),
  getHealth: () => request('/api/health'),

  // Auth
  login: (credentials) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  register: (data) => request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMe: () => request('/api/auth/me'),

  // Documents
  getDocuments: () => request('/api/documents'),
  uploadDocuments: (formData) => request('/api/documents/upload', {
    method: 'POST',
    body: formData,
  }),
  deleteDocument: (docId) => request(`/api/documents/${docId}`, {
    method: 'DELETE',
  }),
  getDocumentChunks: (docId) => request(`/api/documents/${docId}/chunks`),
  loadSampleDocuments: () => request('/api/documents/load-samples', {
    method: 'POST',
  }),

  // Chat
  sendMessage: (payload) => request('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getChatHistory: () => request('/api/chat/history'),
  clearChatHistory: () => request('/api/chat/history', {
    method: 'DELETE',
  }),

  // Side-by-Side Comparison
  compare: (payload) => request('/api/chat/compare', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Evaluation
  getBenchmark: () => request('/api/evaluation/benchmark'),
  runEvaluation: (topK = 4) => request(`/api/evaluation/run?top_k=${topK}`, {
    method: 'POST',
  }),
  getEvaluationRuns: () => request('/api/evaluation/runs'),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (settings) => request('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
};
