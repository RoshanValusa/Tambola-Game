import axios from 'axios';
import { config } from '../config';
import { useSessionStore } from '../store/sessionStore';

export const http = axios.create({
  baseURL: `${config.apiUrl}/api`,
  timeout: 10_000,
});

http.interceptors.request.use((req) => {
  const token = useSessionStore.getState().token;
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err?.response?.data;
    const message = data?.error?.message ?? err.message ?? 'Request failed';
    return Promise.reject(new Error(message));
  },
);
