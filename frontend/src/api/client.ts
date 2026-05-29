import axios from 'axios';

// Base axios instance for API calls
export const apiClient = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      // Redirect to login or refresh token
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
