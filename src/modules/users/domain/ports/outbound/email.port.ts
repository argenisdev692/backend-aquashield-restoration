export interface IEmailPort {
  sendPasswordSetupLink(params: {
    to: string;
    setupLink: string;
    name: string;
    type: 'setup' | 'change';
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
