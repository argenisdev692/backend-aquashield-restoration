import { PasswordPolicyException } from '../exceptions/auth-domain.exception';

/**
 * Plaintext password value object — exists only inside the application
 * boundary (use case input). Never persisted; never logged. The raw value
 * must be passed straight to an IPasswordHasher and dropped.
 *
 * Policy enforced (matches the Laravel reference spec):
 *  - length ≥ 12
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one digit
 *  - at least one symbol (anything non-alphanumeric)
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export class PlaintextPassword {
  private constructor(private readonly raw: string) {}

  static create(value: unknown): PlaintextPassword {
    if (typeof value !== 'string') {
      throw new PasswordPolicyException(['password must be a string']);
    }
    const violations = PlaintextPassword.collectViolations(value);
    if (violations.length > 0) {
      throw new PasswordPolicyException(violations);
    }
    return new PlaintextPassword(value);
  }

  static collectViolations(value: string): string[] {
    const v: string[] = [];
    if (value.length < PASSWORD_MIN_LENGTH) {
      v.push(`must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
      v.push(`must be at most ${PASSWORD_MAX_LENGTH} characters`);
    }
    if (!/[a-z]/.test(value)) v.push('must contain a lowercase letter');
    if (!/[A-Z]/.test(value)) v.push('must contain an uppercase letter');
    if (!/[0-9]/.test(value)) v.push('must contain a digit');
    if (!/[^a-zA-Z0-9]/.test(value)) v.push('must contain a symbol');
    return v;
  }

  /** Read the raw value — caller must immediately pass it to a hasher. */
  reveal(): string {
    return this.raw;
  }

  /** Defensive override so the raw value cannot leak through logging. */
  toString(): string {
    return '[redacted-password]';
  }

  toJSON(): string {
    return '[redacted-password]';
  }
}
