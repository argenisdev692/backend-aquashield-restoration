import { OtpCode } from './otp-code.vo';

describe('OtpCode (domain VO)', () => {
  it('generates a 4-digit code with a future expiry', () => {
    const otp = OtpCode.generate(5);
    expect(otp.code).toMatch(/^\d{4}$/);
    expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(otp.isExpired()).toBe(false);
  });

  it('verifies the matching code only when not expired', () => {
    const otp = OtpCode.generate(5);
    expect(otp.verify(otp.code)).toBe(true);
    expect(otp.verify('0000')).toBe(otp.code === '0000');
  });

  it('rejects verification once expired', () => {
    const past = new Date(Date.now() - 1000);
    const otp = OtpCode.from('1234', past);
    expect(otp.isExpired()).toBe(true);
    expect(otp.verify('1234')).toBe(false);
  });

  it('rejects a malformed code in from()', () => {
    expect(() => OtpCode.from('12', new Date())).toThrow(
      'OTP code must be a 4 or 6 digit string',
    );
  });

  it('generates a 6-digit code with generate6()', () => {
    const otp = OtpCode.generate6(10);
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.isExpired()).toBe(false);
  });
});
