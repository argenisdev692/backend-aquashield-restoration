/**
 * IBreachedPasswordPort — outbound port for "has this password appeared in a
 * known data breach?" (OWASP/NIST: screen new passwords against breach corpora
 * instead of forcing composition rules).
 *
 * Implementations MUST be fail-open: a check that cannot complete (timeout,
 * provider down) returns `false` so a third-party outage never blocks
 * registration or password changes.
 */
export interface IBreachedPasswordPort {
  /** `true` only if the password is positively known to be breached. */
  isBreached(password: string): Promise<boolean>;
}

export const BREACHED_PASSWORD_PORT = Symbol('IBreachedPasswordPort');

/** Shared user-facing rejection message (DRY across every password flow). */
export const BREACHED_PASSWORD_MESSAGE =
  'This password has appeared in a known data breach. Please choose a different one.';
