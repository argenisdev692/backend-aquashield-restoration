/**
 * Structured context attached to every log entry.
 *
 * `traceId` and `correlationId` are mandatory on every handler/adapter log
 * (enforced by LoggerService reading them from CLS). Everything else is
 * optional metadata describing the operation.
 */
export interface LogContext {
  traceId?: string;
  correlationId?: string;
  userId?: string;
  /** Architectural layer emitting the log: 'use-case' | 'adapter' | 'controller' | ... */
  layer?: string;
  /** Logical service / module name. */
  service?: string;
  /** Operation duration in milliseconds, when measured. */
  durationMs?: number;
  /** Any additional, non-sensitive structured fields. */
  [key: string]: unknown;
}
