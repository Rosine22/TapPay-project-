import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';
const TOKEN_KEY = 'tappay.token';

const api = axios.create({ baseURL, timeout: 15000 });

let memoryToken = null;

export async function setToken(token) {
  memoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function loadToken() {
  memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

api.interceptors.request.use((config) => {
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Cannot reach TapPay. Check your connection.' : 'Something went wrong');
    return Promise.reject(Object.assign(new Error(message), { status: error.response?.status }));
  }
);

/* auth */
export const register = (payload) => api.post('/auth/register', payload).then((r) => r.data);
export const login = (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data);
export const me = () => api.get('/auth/me').then((r) => r.data.user);

/* wallet + history */
export const getWallet = () => api.get('/wallet').then((r) => r.data.wallet);
export const getTransactions = () => api.get('/transactions').then((r) => r.data.transactions);

/* people */
export const getMyQr = () => api.get('/users/me/qr').then((r) => r.data.qr);
export const lookupPaymentId = (paymentId) =>
  api.get(`/users/payment/${paymentId}`).then((r) => r.data.user);

/* NFC / POS */
export const getSession = (sessionId) =>
  api.get(`/payment-sessions/${sessionId}`).then((r) => r.data.session);
export const authorizeSession = (sessionId, pin) =>
  api.post(`/payment-sessions/${sessionId}/authorize`, { pin }).then((r) => r.data);

/* QR person-to-person */
export const createPaymentRequest = (receiverPaymentId, amount, pin) =>
  api.post('/payment-requests', { receiverPaymentId, amount, pin }).then((r) => r.data);
export const receivedRequests = () => api.get('/payment-requests/received').then((r) => r.data.requests);
export const sentRequests = () => api.get('/payment-requests/sent').then((r) => r.data.requests);
export const approveRequest = (id) => api.patch(`/payment-requests/${id}/approve`).then((r) => r.data);
export const rejectRequest = (id) => api.patch(`/payment-requests/${id}/reject`).then((r) => r.data);

export default api;
