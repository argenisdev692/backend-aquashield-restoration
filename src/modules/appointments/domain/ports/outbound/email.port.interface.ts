export interface IEmailPort {
  /** Generic transport (kept for ad-hoc/internal mails). */
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;

  /** "New message – appointment" → every admin/super-admin recipient. */
  notifyAdminsNewLead(params: {
    adminEmails: string[];
    appointmentId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    message: string | null;
  }): Promise<void>;

  /** "Message sent successfully" → the lead who submitted the form. */
  sendSubmissionConfirmation(params: {
    toEmail: string;
    toName: string;
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
