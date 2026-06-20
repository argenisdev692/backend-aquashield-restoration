import type { SendMailParams } from './mailer.types';

/**
 * Payload for a generic email job on the shared `email` BullMQ queue.
 *
 * Templated HTML is rendered by the calling module BEFORE enqueuing, so the
 * job carries only the already-rendered `{ to, subject, html, text }`. This
 * keeps the shared processor template-agnostic — it just delivers.
 *
 * `traceId` is captured from CLS at enqueue time so the worker (which runs
 * outside the originating request's CLS context) can re-seed it and keep
 * delivery logs correlated to the request that triggered the email.
 */
export type EmailJob = SendMailParams & {
  /** CLS traceId of the request that enqueued this email. */
  traceId?: string;
};

/**
 * BullMQ job name for generic emails. Used so the dashboard groups these jobs
 * separately from the auth transactional queue.
 */
export const EMAIL_JOB_NAME = 'email.send';
