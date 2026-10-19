import axios from 'axios';

// Empty means "same origin" (the backend serving the built frontend)
export const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: API_URL, timeout: 20000 });

const storedToken = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo'))?.token || null;
  } catch {
    return null;
  }
};

// Attach the signed-in user's token to every request
api.interceptors.request.use((config) => {
  const token = storedToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 on an authenticated request means the session expired or the account
// is gone: tell the app to sign out instead of failing silently everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = error.config?.headers?.Authorization;
    if (error.response?.status === 401 && sentToken && !error.config.url.includes('/api/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

/** Absolute URL for files served by the API (e.g. uploaded avatars). */
export const assetUrl = (path) => {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
};

/** The server's error message, or a fallback for network failures. */
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!error?.response) return 'Could not reach the server. Check your connection.';
  return error.response.data?.message || fallback;
};

export default api;
