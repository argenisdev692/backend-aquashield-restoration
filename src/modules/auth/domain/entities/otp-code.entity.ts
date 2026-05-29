import {
  OtpCodeType,
  OTP_CODE_TTL_SECONDS,
} from '../value-objects/otp-code-type.vo';
import {
  OtpExpiredException,
  OtpInvalidException,
} from '../exceptions/auth-domain.exception';

/**
 * Append-only OTP store. Rows never update except `usedAt` set on consumption.
 *
 * `code` is stored as plain text (4–6 digits, short-lived) because:
 *  - rows are invalidated by `usedAt` on first match
 *  - rows expire via `expiresAt` (TTL_SECONDS per type)
 *  - reasonable rate-limiting on the verify endpoint prevents brute force
 *  - hashing a 6-digit code with bcrypt offers no real security gain
 *    (search space is 10^6 — hash makes verification slower, not safer)
 */
export class OtpCode {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly code: string,
    public readonly type: OtpCodeType,
    public readonly expiresAt: Date,
    private _usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static create(props: {
    userId: string;
    code: string;
    type: OtpCodeType;
    now?: Date;
  }): OtpCode {
    if (!props.userId) throw new Error('OtpCode.userId is required');
    if (!/^\d{4,6}$/.test(props.code)) {
      throw new Error('OtpCode.code must be 4–6 digits');
    }
    const now = props.now ?? new Date();
    const expiresAt = new Date(
      now.getTime() + OTP_CODE_TTL_SECONDS[props.type] * 1000,
    );
    return new OtpCode(null, props.userId, props.code, props.type, expiresAt, null, now);
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    code: string;
    type: OtpCodeType;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): OtpCode {
    return new OtpCode(
      props.id,
      props.userId,
      props.code,
      props.type,
      props.expiresAt,
      props.usedAt,
      props.createdAt,
    );
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isUsed(): boolean {
    return this._usedAt !== null;
  }

  /**
   * Validate the candidate code against this OTP. Marks the row used on
   * success. Throws OtpInvalid / OtpExpired on failure — never returns false,
   * so callers cannot accidentally ignore the result.
   */
  consume(candidate: string, now: Date = new Date()): void {
    if (this.isUsed()) throw new OtpInvalidException();
    if (this.isExpired(now)) throw new OtpExpiredException();
    if (candidate !== this.code) throw new OtpInvalidException();
    this._usedAt = now;
  }
}
