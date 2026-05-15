export interface IEmailPort {
  sendOtp(params: {
    to: string;
    code: string;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
