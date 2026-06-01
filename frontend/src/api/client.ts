import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStore } from './token-store';

const BASE_URL =
  process.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Base axios instance for API calls.
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Routes that must NOT trigger a refresh-and-retry: they either issue tokens
// or are valid without one. Hitting /refresh recursively would loop forever.
const AUTH_PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function isAuthPublic(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PUBLIC_PATHS.some((p) => url.includes(p));
}

// ── Request: attach the current access token ────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.getAccess();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response: silent refresh-and-retry on 401 ───────────────────────────────
// Single-flight: concurrent 401s share ONE /auth/refresh call instead of
// firing N rotations (which would invalidate each other, since refresh tokens
// rotate on every use).
let refreshPromise: Promise<string> | null = null;

async function rotateAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  // Bare axios (not apiClient) so this call skips the interceptors.
  const { data } = await axios.post<{
    accessToken: string;
    refreshToken: string;
  }>(`${BASE_URL}/auth/refresh`, { refreshToken });

  tokenStore.set(data.accessToken, data.refreshToken);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const shouldRefresh =
      error.response?.status === 401 &&
      original != null &&
      !original._retry &&
      !isAuthPublic(original.url);

    if (!shouldRefresh) return Promise.reject(error);

    original._retry = true;
    try {
      // Reuse the in-flight rotation if one is already running.
      refreshPromise ??= rotateAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      original.headers = {
        ...original.headers,
        Authorization: `Bearer ${newToken}`,
      };
      return apiClient(original);
    } catch (refreshError) {
      // Refresh itself failed → the session is truly over. Only now log out.
      tokenStore.clear();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
