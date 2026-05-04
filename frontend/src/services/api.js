import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

api.interceptors.request.use(config => {
  const token    = localStorage.getItem('token');
  const clientId = localStorage.getItem('activeClientId');
  if (token)    config.headers.Authorization  = `Bearer ${token}`;
  if (clientId) config.headers['X-Client-Id'] = clientId;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = (process.env.REACT_APP_BASENAME || '/instaauto') + '/login';
    }
    return Promise.reject(err);
  }
);

export const flowsAPI = {
  getAll: () => api.get('/flows').then(r => r.data),
  create: (flow) => api.post('/flows', flow).then(r => r.data),
  update: (id, data) => api.patch(`/flows/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/flows/${id}`).then(r => r.data),
  toggle: (id, active) => api.patch(`/flows/${id}`, { active }).then(r => r.data),
};

export const analyticsAPI = {
  getStats:    () => api.get('/analytics/stats').then(r => r.data),
  getEvents:   (limit = 50) => api.get(`/analytics/events?limit=${limit}`).then(r => r.data),
  getKeywords: () => api.get('/analytics/keywords').then(r => r.data),
  getDaily:    () => api.get('/analytics/daily').then(r => r.data),
};

export default api;
