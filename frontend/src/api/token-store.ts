// Single source of truth for auth tokens.
// Keep storage access in one place so the interceptor and the mutator never
// drift apart on key names.
const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
