/**
 * CLS (Continuation-Local Storage) context keys.
 *
 * These are the ONLY keys allowed in the request-scoped CLS store.
 * Never pass traceId / correlationId as function parameters — always
 * read them from ClsService using these constants.
 */
export const CLS_KEYS = {
  TRACE_ID: 'traceId',
  CORRELATION_ID: 'correlationId',
  USER_ID: 'userId',
  /** Client IP captured by the CLS middleware (`req.ip`). */
  IP_ADDRESS: 'ipAddress',
  /** Raw User-Agent header captured by the CLS middleware. */
  USER_AGENT: 'userAgent',
  /** Raw cookie header value of the trusted-device token (`td`), if any. */
  TRUSTED_DEVICE_TOKEN: 'trustedDeviceToken',
} as const;

export type ClsKey = (typeof CLS_KEYS)[keyof typeof CLS_KEYS];

/**
 * Inbound header names used to propagate request context across services.
 */
export const CONTEXT_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
} as const;
