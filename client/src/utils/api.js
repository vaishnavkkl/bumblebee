import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('bb-token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
