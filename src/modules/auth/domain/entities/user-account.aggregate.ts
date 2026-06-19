import { Email } from '../value-objects/email.vo';
import { TotpSecret } from '../value-objects/totp-secret.vo';
import {
  AccountLockedException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
  TwoFactorAlreadyEnabledException,
  TwoFactorNotEnabledException,
} from '../exceptions/auth-domain.exception';
import { AccountLockedEvent } from '../events/account-locked.event';
import {
  PasswordChangedEvent,
  PasswordChangeSource,
} from '../events/password-changed.event';
import {
  TwoFactorDisabledEvent,
  TwoFactorEnabledEvent,
} from '../events/two-factor-enabled.event';

/**
 * Account-lockout policy (matches the Laravel reference spec).
 *  - 10 consecutive failed logins inside FAILED_LOGIN_WINDOW_SECONDS
 *    → lock for ACCOUNT_LOCKOUT_DURATION_MINUTES.
 *  - Counter lives in Redis (rate-limiter port); the aggregate only owns
 *    the lock tombstone (`lockedUntil`).
 */
export const FAILED_LOGIN_LOCKOUT_THRESHOLD = 10;
export const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 15;
/**
 * After N failed attempts (half the lockout threshold), fire a
 * `SuspiciousActivityDetectedEvent` so the legitimate owner is alerted
 * BEFORE the account is locked.
 */
export const FAILED_LOGIN_WARN_THRESHOLD = 5;

/**
 * Fresh-password window — how long after `passwordConfirmedAt` the user is
 * considered "freshly authenticated" for sensitive operations (regenerate
 * backup codes, disable 2FA, change email, unlink social provider).
 */
export const FRESH_PASSWORD_WINDOW_SECONDS = 5 * 60;

/**
 * Rich domain aggregate representing the authentication-relevant slice of
 * a `User` row. Profile fields (address, phone, etc.) live in the `users`
 * module and are NOT modelled here — keeping the aggregate small avoids
 * coupling the auth invariants to unrelated changes.
 */
export interface UserAccountProps {
  id: string;
  email: Email;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  totpSecret: TotpSecret | null;
  totpEnabled: boolean;
  googleId: string | null;
  passwordConfirmedAt: Date | null;
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  lockedUntil: Date | null;
}

export class UserAccount {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    private _passwordHash: string | null,
    private _emailVerifiedAt: Date | null,
    private _totpSecret: TotpSecret | null,
    private _totpEnabled: boolean,
    private _googleId: string | null,
    private _passwordConfirmedAt: Date | null,
    private _mustChangePassword: boolean,
    private _passwordExpiresAt: Date | null,
    private _passwordChangedAt: Date | null,
    private _lockedUntil: Date | null,
    private readonly _domainEvents: unknown[] = [],
  ) {}

  static reconstitute(props: UserAccountProps): UserAccount {
    return new UserAccount(
      props.id,
      props.email,
      props.passwordHash,
      props.emailVerifiedAt,
      props.totpSecret,
      props.totpEnabled,
      props.googleId,
      props.passwordConfirmedAt,
      props.mustChangePassword,
      props.passwordExpiresAt,
      props.passwordChangedAt,
      props.lockedUntil,
      [],
    );
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  get passwordHash(): string | null {
    return this._passwordHash;
  }
  get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }
  get totpSecret(): TotpSecret | null {
    return this._totpSecret;
  }
  get totpEnabled(): boolean {
    return this._totpEnabled;
  }
  get googleId(): string | null {
    return this._googleId;
  }
  get passwordConfirmedAt(): Date | null {
    return this._passwordConfirmedAt;
  }
  get mustChangePassword(): boolean {
    return this._mustChangePassword;
  }
  get passwordExpiresAt(): Date | null {
    return this._passwordExpiresAt;
  }
  get passwordChangedAt(): Date | null {
    return this._passwordChangedAt;
  }
  get lockedUntil(): Date | null {
    return this._lockedUntil;
  }
  get domainEvents(): readonly unknown[] {
    return [...this._domainEvents];
  }

  // ─── Predicates ──────────────────────────────────────────────────────────

  isEmailVerified(): boolean {
    return this._emailVerifiedAt !== null;
  }

  isLocked(now: Date = new Date()): boolean {
    return (
      this._lockedUntil !== null && this._lockedUntil.getTime() > now.getTime()
    );
  }

  hasPasswordAuth(): boolean {
    return this._passwordHash !== null;
  }

  hasSocialAuth(): boolean {
    return this._googleId !== null;
  }

  isFreshlyAuthenticated(now: Date = new Date()): boolean {
    if (this._passwordConfirmedAt === null) return false;
    const ageSec = (now.getTime() - this._passwordConfirmedAt.getTime()) / 1000;
    return ageSec <= FRESH_PASSWORD_WINDOW_SECONDS;
  }

  isPasswordExpired(now: Date = new Date()): boolean {
    return (
      this._passwordExpiresAt !== null &&
      this._passwordExpiresAt.getTime() <= now.getTime()
    );
  }

  // ─── Login gating ────────────────────────────────────────────────────────

  /**
   * Pre-credential-check gate. Run BEFORE comparing the password hash so
   * we don't reveal whether the email exists when the account is locked.
   *
   * NOTE: caller MUST still emit `LoginFailedEvent('account_locked', ...)`
   * via the use-case; the aggregate cannot know the IP / user-agent.
   */
  assertCanAttemptLogin(now: Date = new Date()): void {
    if (this.isLocked(now)) {
      throw new AccountLockedException(this._lockedUntil!);
    }
  }

  /**
   * Post-credential-check gate. Run AFTER verifying the password (or social
   * token) so we don't disclose verification state to attackers.
   */
  assertCanCompleteLogin(): void {
    if (!this.isEmailVerified()) {
      throw new EmailNotVerifiedException();
    }
  }

  /**
   * Called by the use-case when the rate-limiter reports the user just
   * crossed FAILED_LOGIN_LOCKOUT_THRESHOLD failures in window. Sets the
   * lockout tombstone and emits AccountLockedEvent.
   */
  lock(reason: { ipAddress: string | null; now?: Date }): void {
    const now = reason.now ?? new Date();
    const until = new Date(
      now.getTime() + ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );
    this._lockedUntil = until;
    this.addEvent(
      new AccountLockedEvent(
        this.id,
        this.email.value,
        until,
        reason.ipAddress,
        now,
      ),
    );
  }

  unlock(): void {
    this._lockedUntil = null;
  }

  /**
   * Marks the password as freshly confirmed — used by `confirm-password.use-case`
   * and indirectly by successful login.
   */
  confirmPassword(now: Date = new Date()): void {
    this._passwordConfirmedAt = now;
  }

  /** Clear lockout + bump confirmation timestamp on successful credential check. */
  recordSuccessfulLogin(now: Date = new Date()): void {
    this._lockedUntil = null;
    this._passwordConfirmedAt = now;
  }

  // ─── Email verification ──────────────────────────────────────────────────

  verifyEmail(now: Date = new Date()): void {
    if (this._emailVerifiedAt !== null) return; // idempotent
    this._emailVerifiedAt = now;
  }

  // ─── Password ────────────────────────────────────────────────────────────

  /**
   * Replace the password hash. Caller is responsible for:
   *  1. Verifying the OLD password (or that the user reached this method via
   *     a single-use reset token).
   *  2. Checking the new password is not in the password history (use the
   *     PasswordHistoryRepository; the aggregate cannot reach side state).
   *  3. Persisting the new hash + appending a PasswordHistoryEntry.
   *
   * The aggregate updates timestamps and emits PasswordChangedEvent.
   */
  changePassword(
    newPasswordHash: string,
    source: PasswordChangeSource,
    options: {
      keepSessionId?: string | null;
      ipAddress?: string | null;
      passwordTtlDays?: number | null;
      now?: Date;
    } = {},
  ): void {
    if (!newPasswordHash) {
      throw new Error('newPasswordHash must be provided');
    }
    const now = options.now ?? new Date();
    this._passwordHash = newPasswordHash;
    this._passwordChangedAt = now;
    this._passwordConfirmedAt = now;
    this._mustChangePassword = false;
    this._passwordExpiresAt =
      options.passwordTtlDays && options.passwordTtlDays > 0
        ? new Date(
            now.getTime() + options.passwordTtlDays * 24 * 60 * 60 * 1000,
          )
        : null;
    // On password change/reset we also clear the lockout — a successful
    // reset implies the legitimate owner is in control.
    this._lockedUntil = null;

    this.addEvent(
      new PasswordChangedEvent(
        this.id,
        source,
        options.keepSessionId ?? null,
        options.ipAddress ?? null,
        now,
      ),
    );
  }

  /**
   * Admin / "first login" flag — forces the next authenticated request to
   * go through change-password before doing anything else.
   */
  flagMustChangePassword(): void {
    this._mustChangePassword = true;
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────

  /**
   * Start the 2FA enrollment. Stores the candidate secret but does NOT mark
   * 2FA enabled — the user must verify a TOTP code from their authenticator
   * before `enableTwoFactor` is called.
   */
  startTwoFactorSetup(secret: TotpSecret): void {
    if (this._totpEnabled) {
      throw new TwoFactorAlreadyEnabledException();
    }
    this._totpSecret = secret;
  }

  /**
   * Confirm the enrollment after the user verifies a TOTP code. Caller MUST
   * have validated the candidate code via ITotpService.verify() first.
   */
  enableTwoFactor(backupCodesIssued: number, now: Date = new Date()): void {
    if (this._totpEnabled) {
      throw new TwoFactorAlreadyEnabledException();
    }
    if (this._totpSecret === null) {
      throw new Error('Two-factor setup must be started before enabling');
    }
    this._totpEnabled = true;
    this.addEvent(
      new TwoFactorEnabledEvent(
        this.id,
        this.email.value,
        backupCodesIssued,
        now,
      ),
    );
  }

  disableTwoFactor(now: Date = new Date()): void {
    if (!this._totpEnabled) {
      throw new TwoFactorNotEnabledException();
    }
    this._totpEnabled = false;
    this._totpSecret = null;
    this.addEvent(new TwoFactorDisabledEvent(this.id, this.email.value, now));
  }

  // ─── Social ──────────────────────────────────────────────────────────────

  /**
   * Link a Google account. Refuses to overwrite an existing different link —
   * the use-case must detect and surface the conflict.
   */
  linkGoogleAccount(googleId: string): void {
    if (!googleId) throw new Error('googleId is required');
    if (this._googleId !== null && this._googleId !== googleId) {
      throw new InvalidCredentialsException();
    }
    this._googleId = googleId;
    // Mark email verified — Google-issued emails are pre-verified.
    if (this._emailVerifiedAt === null) {
      this._emailVerifiedAt = new Date();
    }
  }

  unlinkGoogleAccount(): void {
    this._googleId = null;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  private addEvent(event: unknown): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }
}
