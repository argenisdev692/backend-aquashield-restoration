import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';

// Orval mutator — route every generated call through `apiClient` so the
// shared request/response interceptors (Bearer injection + silent refresh)
// apply uniformly. Token handling lives in client.ts / token-store.ts.
export const axiosMutator = <T>(config: AxiosRequestConfig): Promise<T> =>
  apiClient(config).then((res) => res.data);
