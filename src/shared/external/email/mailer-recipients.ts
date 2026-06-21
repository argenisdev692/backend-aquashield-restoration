import { sanitizeRecipients } from './email-html.util';
import type { SendMailParams, SendMailResult } from './mailer.types';

/**
 * Canonical "nothing to deliver" result. Reused by every {@link IMailer}
 * implementation so the skip contract is identical across the queued facade
 * and the low-level transports.
 */
export const SKIPPED_RESULT: SendMailResult = {
  delivered: false,
  skipped: true,
};

/** Minimal logger surface — keeps this helper free of NestJS / nestjs-cls. */
interface SkipLogger {
  info(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Either the cleaned recipient list, or a pre-built skip result when every
 * recipient was filtered (empty / reserved `example.com` addresses).
 */
export type RecipientResolution =
  | { readonly recipients: string[] }
  | { readonly skip: SendMailResult };

/**
 * Shared recipient guard for all mailer adapters.
 *
 * Sanitizes + de-duplicates `params.to`; when nothing remains it logs the
 * skip (with the request `traceId`) and returns {@link SKIPPED_RESULT} so the
 * caller can short-circuit with a single `if ('skip' in r) return r.skip`.
 * `traceId` is passed in (read from CLS at the call site) so this stays a pure
 * helper with no framework coupling.
 */
export function resolveRecipientsOrSkip(
  params: SendMailParams,
  logger: SkipLogger,
  traceId: string | undefined,
): RecipientResolution {
  const recipients = sanitizeRecipients(params.to);

  if (recipients.length === 0) {
    logger.info('Mailer skip — no real recipients (empty or example.com)', {
      traceId,
      subject: params.subject,
    });
    return { skip: SKIPPED_RESULT };
  }

  return { recipients };
}
