import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'tappay.pos.token';

const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn any failure into a plain message the terminal can show on screen.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Cannot reach the TapPay server' : 'Something went wrong');
    return Promise.reject(Object.assign(new Error(message), { status: error.response?.status }));
  }
);

export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data);

export const me = () => api.get('/auth/me').then((r) => r.data.user);

export const merchantSummary = () => api.get('/wallet/merchant-summary').then((r) => r.data.summary);

export const createSession = (amount) =>
  api.post('/payment-sessions', { amount }).then((r) => r.data.session);

export const getSession = (sessionId) =>
  api.get(`/payment-sessions/${sessionId}`).then((r) => r.data.session);

export const cancelSession = (sessionId) =>
  api.post(`/payment-sessions/${sessionId}/cancel`).then((r) => r.data.session);

export const recentSessions = () => api.get('/payment-sessions/mine').then((r) => r.data.sessions);

export default api;
