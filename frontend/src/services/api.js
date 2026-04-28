import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/instaauto/login';
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
  getStats: () => api.get('/analytics/stats').then(r => r.data),
  getEvents: (limit = 50) => api.get(`/analytics/events?limit=${limit}`).then(r => r.data),
};
