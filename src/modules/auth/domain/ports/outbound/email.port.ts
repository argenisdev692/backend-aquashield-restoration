export interface IEmailPort {
  sendOtp(params: {
    to: string;
    code: string;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void>;
  sendPasswordResetCode(params: {
    to: string;
    code: string;
    name: string;
    ttlMinutes: number;
  }): Promise<void>;
  sendPasswordResetLink(params: {
    to: string;
    resetLink: string;
  }): Promise<void>;
  sendVerificationLink(params: {
    to: string;
    verificationLink: string;
    name: string;
  }): Promise<void>;
  sendWelcomeEmail(params: { to: string; name: string }): Promise<void>;
  sendSecurityAlert(params: {
    to: string;
    event: 'login_attempts' | 'reset_attempts';
    attemptCount: number;
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
