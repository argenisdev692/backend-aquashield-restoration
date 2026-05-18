export interface IEmailPort {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
