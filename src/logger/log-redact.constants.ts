/**
 * Pino redaction paths — applied globally so secrets never reach any sink.
 *
 * Never sanitize manually per service: extend this list instead.
 * Covers request headers, request/response bodies, and nested objects.
 */
export const LOG_REDACT_PATHS: readonly string[] = [
  // Auth material
  'password',
  'hashedPassword',
  'newPassword',
  'currentPassword',
  'confirmNewPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  // Nested under request/response objects logged by pino-http
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.hashedPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
] as const;

export const LOG_REDACT_CENSOR = '[REDACTED]';
