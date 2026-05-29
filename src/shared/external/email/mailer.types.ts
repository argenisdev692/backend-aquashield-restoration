/**
 * Public contract types for the shared mailer.
 *
 * Module-specific email ports (auth/users/appointments/contact-support)
 * build their templated HTML and delegate the actual delivery to `IMailer`.
 */

export interface SendMailParams {
  /** Single address or an array — adapters fan-out internally. */
  to: string | string[];
  subject: string;
  /** Rendered HTML body. User-controlled fields MUST be escaped at the call site. */
  html: string;
  /** Optional plain-text alternative for clients that block HTML. */
  text?: string;
}

export interface SendMailResult {
  /** `true` when the provider accepted the request OR when delivery was skipped on purpose (e.g. example.com). */
  delivered: boolean;
  /** `true` when delivery was skipped (no real recipients). */
  skipped: boolean;
}
