import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from './log-redact.constants';

interface PinoConfigInput {
  isProduction: boolean;
  logLevel: string;
}

/**
 * Builds the nestjs-pino `Params`.
 *
 * - Development → `pino-pretty` colorized stdout.
 * - Production  → raw JSON to stdout (Docker/K8s → Loki/Datadog/CloudWatch).
 * - Secrets are redacted globally via the shared redact path list.
 * - `traceId` / `correlationId` are surfaced on every HTTP log line from the
 *   request object (populated by the CLS middleware before logging runs).
 */
export function buildPinoParams({
  isProduction,
  logLevel,
}: PinoConfigInput): Params {
  return {
    pinoHttp: {
      level: logLevel,
      redact: {
        paths: [...LOG_REDACT_PATHS],
        censor: LOG_REDACT_CENSOR,
      },
      // Stable, machine-parseable timestamps in prod; pretty handles dev.
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      base: undefined,
      autoLogging: true,
      customProps: (req: IncomingMessage): Record<string, unknown> => {
        const r = req as IncomingMessage & {
          traceId?: string;
          correlationId?: string;
        };
        return {
          traceId: r.traceId,
          correlationId: r.correlationId,
        };
      },
      customSuccessMessage: (
        _req: IncomingMessage,
        res: ServerResponse,
      ): string => `request completed ${res.statusCode}`,
      customErrorMessage: (
        _req: IncomingMessage,
        res: ServerResponse,
        err: Error,
      ): string => `request failed ${res.statusCode} ${err.message}`,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
    },
  };
}
