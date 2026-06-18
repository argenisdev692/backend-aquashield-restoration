import type { Appointment } from '../../domain/entities/appointment.aggregate';
import type { AppointmentEmailData } from '../../domain/ports/outbound/email.port.interface';

/**
 * Projects an Appointment aggregate to the VO-free snapshot the lifecycle
 * email templates consume. Single source of truth shared by every email
 * listener so the field list stays in one place.
 */
export function toAppointmentEmailData(
  appointment: Appointment,
): AppointmentEmailData {
  const plain = appointment.toPlain();
  return {
    appointmentId: plain.id,
    firstName: plain.firstName,
    lastName: plain.lastName,
    phone: plain.phone,
    email: plain.email,
    address: plain.address,
    address2: plain.address2,
    city: plain.city,
    state: plain.state,
    zipcode: plain.zipcode,
    country: plain.country,
    insuranceProperty: plain.insuranceProperty,
    smsConsent: plain.smsConsent,
    message: plain.message,
    notes: plain.notes,
    leadSource: plain.leadSource,
    inspectionDate: plain.inspectionDate,
    inspectionTime: plain.inspectionTime,
  };
}
