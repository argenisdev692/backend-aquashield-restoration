import type { AxiosRequestConfig } from 'axios';

// Custom mutator to add auth headers and other request modifications
export const axiosMutator = async (config: AxiosRequestConfig) => {
  // Add auth token from localStorage or your auth state
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // Add any other custom headers or transformations
  return config;
};
