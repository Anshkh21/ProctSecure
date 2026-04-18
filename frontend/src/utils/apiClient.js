/**
 * Centralized Axios API client for ProctorSecure.
 *
 * Usage:
 *   import apiClient from '../utils/apiClient';
 *   const data = await apiClient.get('/exams');
 *   const data = await apiClient.post('/auth/login', payload);
 *
 * The client automatically:
 *   - Resolves the base URL from REACT_APP_BACKEND_URL
 *   - Attaches the JWT Bearer token from localStorage on every request
 *   - Redirects to '/' on 401 Unauthorized responses
 */
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000, // 30-second timeout
});

// ---------------------------------------------------------------------------
// Request interceptor — auto-attach auth token
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 globally
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear session and send to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Also export the raw BACKEND_URL for components that need it directly
// (e.g. constructing WebSocket URLs)
export { BACKEND_URL };
