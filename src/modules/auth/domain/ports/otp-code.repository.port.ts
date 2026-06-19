import { OtpCode } from '../entities/otp-code.entity';
import { OtpCodeType } from '../value-objects/otp-code-type.vo';

export interface IOtpCodeRepository {
  create(otp: OtpCode): Promise<string>;
  save(otp: OtpCode): Promise<void>;

  /**
   * Find the most recent unused, unexpired OTP of the given type for the
   * user. Returns null if no candidate exists.
   */
  findLatestActive(
    userId: string,
    type: OtpCodeType,
    now?: Date,
  ): Promise<OtpCode | null>;

  /**
   * Invalidate every prior OTP of the same type so a new one can be issued.
   * Used before sending a fresh code (login OTP, email-verify, password-reset).
   * Returns the number of rows marked used.
   */
  invalidatePending(
    userId: string,
    type: OtpCodeType,
    now?: Date,
  ): Promise<number>;
}

export const OTP_CODE_REPOSITORY = Symbol('IOtpCodeRepository');
