/**
 * Base domain exception for the Auth bounded context.
 * Every auth-specific failure must extend this so the global filter can
 * map `code` to a stable HTTP problem-details `type`.
 */
export abstract class AuthDomainException extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsException extends AuthDomainException {
  readonly code = 'AUTH_INVALID_CREDENTIALS';
  constructor() {
    super('Invalid credentials');
  }
}

export class EmailNotVerifiedException extends AuthDomainException {
  readonly code = 'AUTH_EMAIL_NOT_VERIFIED';
  constructor() {
    super('Email address has not been verified');
  }
}

export class AccountLockedException extends AuthDomainException {
  readonly code = 'AUTH_ACCOUNT_LOCKED';
  readonly lockedUntil: Date;
  constructor(lockedUntil: Date) {
    super(`Account is locked until ${lockedUntil.toISOString()}`);
    this.lockedUntil = lockedUntil;
  }
}

export class MustChangePasswordException extends AuthDomainException {
  readonly code = 'AUTH_MUST_CHANGE_PASSWORD';
  constructor() {
    super('Password must be changed before continuing');
  }
}

export class TwoFactorRequiredException extends AuthDomainException {
  readonly code = 'AUTH_TWO_FACTOR_REQUIRED';
  readonly challengeId: string;
  constructor(challengeId: string) {
    super('Two-factor authentication required');
    this.challengeId = challengeId;
  }
}

export class TwoFactorInvalidException extends AuthDomainException {
  readonly code = 'AUTH_TWO_FACTOR_INVALID';
  constructor() {
    super('Invalid two-factor code');
  }
}

export class TwoFactorAlreadyEnabledException extends AuthDomainException {
  readonly code = 'AUTH_TWO_FACTOR_ALREADY_ENABLED';
  constructor() {
    super('Two-factor authentication is already enabled');
  }
}

export class TwoFactorNotEnabledException extends AuthDomainException {
  readonly code = 'AUTH_TWO_FACTOR_NOT_ENABLED';
  constructor() {
    super('Two-factor authentication is not enabled');
  }
}

export class BackupCodeInvalidException extends AuthDomainException {
  readonly code = 'AUTH_BACKUP_CODE_INVALID';
  constructor() {
    super('Backup code is invalid or already used');
  }
}

export class PasswordReusedException extends AuthDomainException {
  readonly code = 'AUTH_PASSWORD_REUSED';
  constructor(historyLimit: number) {
    super(`Password cannot match the last ${historyLimit} used passwords`);
  }
}

export class PasswordPolicyException extends AuthDomainException {
  readonly code = 'AUTH_PASSWORD_POLICY';
  readonly violations: readonly string[];
  constructor(violations: readonly string[]) {
    super(`Password does not meet policy: ${violations.join(', ')}`);
    this.violations = violations;
  }
}

export class WeakPasswordException extends PasswordPolicyException {
  constructor(violations: readonly string[]) {
    super(violations);
  }
}

export class OtpInvalidException extends AuthDomainException {
  readonly code = 'AUTH_OTP_INVALID';
  constructor() {
    super('OTP code is invalid, expired, or already used');
  }
}

export class OtpExpiredException extends AuthDomainException {
  readonly code = 'AUTH_OTP_EXPIRED';
  constructor() {
    super('OTP code has expired');
  }
}

export class RefreshTokenRevokedException extends AuthDomainException {
  readonly code = 'AUTH_REFRESH_TOKEN_REVOKED';
  constructor() {
    super('Refresh token has been revoked or is no longer valid');
  }
}

export class RefreshTokenExpiredException extends AuthDomainException {
  readonly code = 'AUTH_REFRESH_TOKEN_EXPIRED';
  constructor() {
    super('Refresh token has expired');
  }
}

export class SessionNotFoundException extends AuthDomainException {
  readonly code = 'AUTH_SESSION_NOT_FOUND';
  constructor(id: string) {
    super(`Session not found: ${id}`);
  }
}

export class UserAccountNotFoundException extends AuthDomainException {
  readonly code = 'AUTH_USER_ACCOUNT_NOT_FOUND';
  constructor() {
    super('User account not found');
  }
}

export class EmailAlreadyRegisteredException extends AuthDomainException {
  readonly code = 'AUTH_EMAIL_ALREADY_REGISTERED';
  constructor() {
    super('Email is already registered');
  }
}

export class SocialAccountAlreadyLinkedException extends AuthDomainException {
  readonly code = 'AUTH_SOCIAL_ALREADY_LINKED';
  constructor(provider: string) {
    super(`${provider} account is already linked to another user`);
  }
}

export class FreshPasswordRequiredException extends AuthDomainException {
  readonly code = 'AUTH_FRESH_PASSWORD_REQUIRED';
  constructor() {
    super('Password confirmation required to perform this action');
  }
}
