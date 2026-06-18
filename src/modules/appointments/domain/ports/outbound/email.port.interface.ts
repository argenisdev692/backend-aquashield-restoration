/**
 * VO-free appointment snapshot consumed by the blade-style lifecycle emails.
 * `inspectionDate` / `inspectionTime` stay as `Date` so the templates can
 * format the schedule; the rest mirror the fields the blade views reference.
 */
export interface AppointmentEmailData {
  appointmentId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string;
  address2: string | null;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  insuranceProperty: boolean;
  smsConsent: boolean;
  message: string | null;
  notes: string | null;
  leadSource: string | null;
  inspectionDate: Date | null;
  inspectionTime: Date | null;
}

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

  // ── Inspection lifecycle (blade-style) ──────────────────────────────────

  /** "Su cita ha sido confirmada" → the client (ES). */
  sendAppointmentConfirmed(params: {
    appointment: AppointmentEmailData;
  }): Promise<void>;

  /** "Su cita ha sido reprogramada" → the client (ES). */
  sendAppointmentRescheduled(params: {
    appointment: AppointmentEmailData;
    previousInspectionDate: Date | null;
    previousInspectionTime: Date | null;
  }): Promise<void>;

  /** "Su cita ha sido cancelada" → the client (ES). */
  sendAppointmentCancelled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void>;

  /** "New Appointment Confirmed" → every admin/super-admin (EN). */
  notifyAdminsAppointmentScheduled(params: {
    adminEmails: string[];
    appointment: AppointmentEmailData;
  }): Promise<void>;

  /** "Appointment Rescheduled Alert" → every admin/super-admin (EN). */
  notifyAdminsAppointmentRescheduled(params: {
    adminEmails: string[];
    appointment: AppointmentEmailData;
    previousInspectionDate: Date | null;
    previousInspectionTime: Date | null;
  }): Promise<void>;

  /** "Appointment Cancelled Alert" → every admin/super-admin (EN). */
  notifyAdminsAppointmentCancelled(params: {
    adminEmails: string[];
    appointment: AppointmentEmailData;
  }): Promise<void>;
}

export const EMAIL_PORT = Symbol('IEmailPort');
