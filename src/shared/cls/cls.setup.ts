import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { ClsModuleOptions } from 'nestjs-cls';
import { CLS_KEYS, CONTEXT_HEADERS } from './cls.constants';

type ContextRequest = IncomingMessage & {
  traceId?: string;
  correlationId?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

const TRUSTED_DEVICE_COOKIE = 'td';

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function headerValue(req: ContextRequest, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Base CLS options: mounts the middleware, generates a per-request `traceId`,
 * and propagates an inbound `x-correlation-id` (or mirrors the traceId when
 * absent). The ids are also stamped onto the request object so pino-http can
 * surface them on automatic HTTP log lines.
 *
 * The transactional plugin is composed on top of this in AppModule (it needs
 * PrismaService), so this stays free of any database dependency.
 */
export function buildClsOptions(): ClsModuleOptions {
  return {
    global: true,
    middleware: {
      mount: true,
      generateId: true,
      idGenerator: (req: ContextRequest): string =>
        headerValue(req, CONTEXT_HEADERS.REQUEST_ID) ?? randomUUID(),
      setup: (cls, req: ContextRequest): void => {
        const traceId = cls.getId();
        const correlationId =
          headerValue(req, CONTEXT_HEADERS.CORRELATION_ID) ?? traceId;

        cls.set(CLS_KEYS.TRACE_ID, traceId);
        cls.set(CLS_KEYS.CORRELATION_ID, correlationId);

        // Capture device context once per request so any layer (use case,
        // token issuer, session repo) can read it from CLS without having
        // to thread the IncomingMessage through every signature.
        const ipAddress =
          req.ip ??
          headerValue(req, 'x-forwarded-for')?.split(',')[0]?.trim() ??
          req.socket?.remoteAddress;
        if (ipAddress) cls.set(CLS_KEYS.IP_ADDRESS, ipAddress);

        const userAgent = headerValue(req, 'user-agent');
        if (userAgent) cls.set(CLS_KEYS.USER_AGENT, userAgent);

        const cookieHeader = headerValue(req, 'cookie');
        const trustedDevice =
          req.cookies?.[TRUSTED_DEVICE_COOKIE] ??
          parseCookie(cookieHeader, TRUSTED_DEVICE_COOKIE);
        if (trustedDevice) cls.set(CLS_KEYS.TRUSTED_DEVICE_TOKEN, trustedDevice);

        // Expose to pino-http customProps (automatic request logging).
        req.traceId = traceId;
        req.correlationId = correlationId;
      },
    },
  };
}
