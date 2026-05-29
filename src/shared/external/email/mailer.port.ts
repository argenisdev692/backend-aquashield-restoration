import type { SendMailParams, SendMailResult } from './mailer.types';

/**
 * Low-level email transport. Knows nothing about business templates —
 * just "deliver this rendered HTML to these recipients".
 *
 * Implementations: ResendMailerAdapter (prod), ConsoleMailerAdapter (dev/tests).
 *
 * Module-specific email ports (e.g. `IUserEmailPort`, `IAppointmentEmailPort`,
 * `ISupportEmailPort`) live in the consuming bounded context and call into
 * this port through the `MAILER` token.
 */
export interface IMailer {
  send(params: SendMailParams): Promise<SendMailResult>;
}

export const MAILER = Symbol('IMailer');
