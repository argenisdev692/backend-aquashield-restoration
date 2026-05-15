import type { OtpCode } from '../value-objects/otp-code.vo';

export interface IOtpRepository {
  save(params: {
    userId: string;
    code: OtpCode;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void>;
  findValid(
    userId: string,
    type: 'login' | 'email_verify' | 'password_reset',
  ): Promise<{ id: string; code: string; expiresAt: Date } | null>;
  markUsed(otpId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export const OTP_REPOSITORY = Symbol('IOtpRepository');
