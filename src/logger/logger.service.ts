import { Injectable, Scope } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import { CLS_KEYS } from '../shared/cls/cls.constants';
import type { LogContext } from './logger.context';

/**
 * Application logger — the ONLY logging entry point.
 *
 * - Wraps the configured Pino instance (never instantiate Pino directly).
 * - Auto-enriches every entry with `traceId` / `correlationId` / `userId`
 *   read from CLS, so callers never have to thread them through parameters.
 * - `console.*` is forbidden project-wide; always inject this service.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
  ) {}

  /** Sets the source context (class/use-case name) shown on every line. */
  setContext(context: string): void {
    this.logger.setContext(context);
  }

  info(message: string, context: LogContext = {}): void {
    this.logger.info(this.enrich(context), message);
  }

  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(this.enrich(context), message);
  }

  error(message: string, context: LogContext = {}): void {
    this.logger.error(this.enrich(context), message);
  }

  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(this.enrich(context), message);
  }

  /**
   * Merges CLS request context into the caller-provided fields.
   * Explicit values in `context` win over CLS so call sites can override.
   */
  private enrich(context: LogContext): LogContext {
    const fromCls: LogContext = {
      traceId: this.safeGet(CLS_KEYS.TRACE_ID),
      correlationId: this.safeGet(CLS_KEYS.CORRELATION_ID),
      userId: this.safeGet(CLS_KEYS.USER_ID),
    };
    return { ...fromCls, ...context };
  }

  private safeGet(key: string): string | undefined {
    return this.cls.isActive()
      ? this.cls.get<string | undefined>(key)
      : undefined;
  }
}
