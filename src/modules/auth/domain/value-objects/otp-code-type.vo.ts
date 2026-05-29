import { z } from 'zod';

export type OtpCodeType = 'login' | 'email_verify' | 'password_reset';

export const OTP_CODE_TYPES = [
  'login',
  'email_verify',
  'password_reset',
] as const;

export const OtpCodeTypeSchema = z.enum(OTP_CODE_TYPES);

export const OTP_CODE_TTL_SECONDS: Record<OtpCodeType, number> = {
  login: 5 * 60, // 5 min
  /**
   * 30-minute window for the 6-digit email verification code sent at
   * register. After expiry the user calls /auth/resend-verification-code
   * to get a fresh one.
   */
  email_verify: 30 * 60,
  password_reset: 60 * 60, // 60 min (matches spec)
};

/**
 * Throttle window for `/auth/resend-verification-code` — refuses to issue
 * a new code less than 60 seconds after the previous one (prevents
 * email-bomb abuse against arbitrary recipients).
 */
export const OTP_RESEND_THROTTLE_SECONDS = 60;
