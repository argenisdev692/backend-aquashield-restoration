import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { LoggerService } from '../../logger/logger.service';
import { CLS_KEYS } from '../../shared/cls/cls.constants';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId?: string;
  errors?: unknown;
}

/**
 * Global error boundary → RFC 7807 `application/problem+json`.
 *
 * Never leaks stack traces or internals in production (OWASP #10).
 * 5xx → ERROR log, 4xx → WARN log, always with the CLS traceId.
 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const traceId = this.cls.isActive()
      ? this.cls.get<string | undefined>(CLS_KEYS.TRACE_ID)
      : undefined;

    const { status, title, detail, errors, retryAfterSeconds } = this.normalize(
      exception,
      isProd,
    );

    const problem: ProblemDetails = {
      type: 'about:blank',
      title,
      status,
      detail,
      instance: req.url,
      traceId,
      ...(errors ? { errors } : {}),
    };

    // RFC 7231 §7.1.3 — `Retry-After` MUST accompany 429 / 503 when we know
    // the back-off window. Apps that throw HttpException with a body
    // `{ retryAfterSeconds: N }` get the header for free.
    if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }

    const logCtx = {
      layer: 'http',
      statusCode: status,
      path: req.url,
      method: req.method,
      error: detail,
    };
    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error('Unhandled exception', logCtx);
    } else {
      this.logger.warn('Request rejected', logCtx);
    }

    res.status(status).type('application/problem+json').json(problem);
  }

  private normalize(
    exception: unknown,
    isProd: boolean,
  ): {
    status: number;
    title: string;
    detail: string;
    errors?: unknown;
    retryAfterSeconds?: number;
  } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'Validation failed',
        detail: 'One or more fields are invalid',
        errors: exception.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : ((response as { message?: unknown }).message ?? exception.message);
      const retryAfterRaw =
        typeof response === 'object'
          ? (response as { retryAfterSeconds?: unknown }).retryAfterSeconds
          : undefined;
      const retryAfterSeconds =
        typeof retryAfterRaw === 'number' && Number.isFinite(retryAfterRaw)
          ? retryAfterRaw
          : undefined;

      return {
        status,
        title: exception.name,
        detail: Array.isArray(detail)
          ? detail.join(', ')
          : typeof detail === 'string'
            ? detail
            : JSON.stringify(detail),
        errors:
          typeof response === 'object'
            ? (response as { errors?: unknown }).errors
            : undefined,
        retryAfterSeconds,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      detail: isProd
        ? 'An unexpected error occurred'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error',
    };
  }
}
