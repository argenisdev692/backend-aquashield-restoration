export interface ISupportEmailPort {
  /** "New message – contact support" → every admin/super-admin recipient. */
  notifyAdminsNewRequest(params: {
    adminEmails: string[];
    requestId: string;
    fromName: string;
    fromEmail: string;
    phone: string;
    subject: string;
    message: string;
  }): Promise<void>;

  /** "Message sent successfully" → the person who submitted the form. */
  sendSubmissionConfirmation(params: {
    toEmail: string;
    toName: string;
    subject: string;
  }): Promise<void>;
}

export const SUPPORT_EMAIL_PORT = Symbol('ISupportEmailPort');
