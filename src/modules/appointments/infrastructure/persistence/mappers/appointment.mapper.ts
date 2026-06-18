import { Appointment } from '../../../domain/entities/appointment.aggregate';
import { AppointmentId } from '../../../domain/value-objects/appointment-id.vo';
import { StatusLeadValue } from '../../../domain/value-objects/status-lead.vo';
import { Phone } from '../../../domain/value-objects/phone.vo';
import { Email } from '../../../domain/value-objects/email.vo';
import { $Enums, Prisma } from '../../../../../generated/prisma/client';
import type { Appointment as AppointmentRow } from '../../../../../generated/prisma/client';
import { AppointmentReadModel } from '../../../domain/repositories/appointment-repository.interface';

export class AppointmentMapper {
  static toDomain(row: AppointmentRow): Appointment {
    const statusLead = row.statusLead
      ? StatusLeadValue.create(row.statusLead)
      : null;

    return new Appointment(
      AppointmentId.create(row.id),
      row.firstName,
      row.lastName,
      Phone.create(row.phone),
      Email.create(row.email),
      row.address,
      row.address2,
      row.city,
      row.state,
      row.zipcode,
      row.country,
      row.insuranceProperty,
      row.message,
      row.smsConsent,
      row.registrationDate,
      row.inspectionDate,
      row.inspectionTime,
      row.inspectionStatus,
      statusLead,
      row.leadSource,
      row.followUpCalls,
      row.notes,
      row.owner,
      row.damageDetail,
      row.intentToClaim,
      row.followUpDate,
      row.additionalNote,
      row.latitude,
      row.longitude,
    );
  }

  static toPersistence(
    entity: Appointment,
  ): Prisma.AppointmentUncheckedCreateInput {
    const plain = entity.toPlain();
    return {
      id: plain.id,
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
      message: plain.message,
      smsConsent: plain.smsConsent,
      registrationDate: plain.registrationDate,
      inspectionDate: plain.inspectionDate,
      inspectionTime: plain.inspectionTime,
      inspectionStatus: plain.inspectionStatus
        ? ($Enums.InspectionStatus[
            plain.inspectionStatus as keyof typeof $Enums.InspectionStatus
          ] ?? null)
        : null,
      statusLead: plain.statusLead
        ? ($Enums.StatusLead[
            plain.statusLead as keyof typeof $Enums.StatusLead
          ] ?? null)
        : null,
      leadSource: plain.leadSource
        ? ($Enums.LeadSource[
            plain.leadSource as keyof typeof $Enums.LeadSource
          ] ?? null)
        : null,
      // followUpCalls is an arbitrary JSONB blob (domain type `unknown`,
      // validated upstream as Zod `z.unknown()`); JS null maps to SQL NULL.
      followUpCalls:
        plain.followUpCalls === null || plain.followUpCalls === undefined
          ? Prisma.JsonNull
          : plain.followUpCalls,
      notes: plain.notes,
      owner: plain.owner,
      damageDetail: plain.damageDetail,
      intentToClaim: plain.intentToClaim,
      followUpDate: plain.followUpDate,
      additionalNote: plain.additionalNote,
      latitude: plain.latitude,
      longitude: plain.longitude,
    };
  }

  static toReadModel(row: AppointmentRow): AppointmentReadModel {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email,
      address: row.address,
      address2: row.address2,
      city: row.city,
      state: row.state,
      zipcode: row.zipcode,
      country: row.country,
      insuranceProperty: row.insuranceProperty,
      message: row.message,
      smsConsent: row.smsConsent,
      registrationDate: row.registrationDate?.toISOString() ?? null,
      inspectionDate: row.inspectionDate?.toISOString() ?? null,
      inspectionTime: row.inspectionTime?.toISOString() ?? null,
      inspectionStatus: row.inspectionStatus,
      statusLead: row.statusLead,
      leadSource: row.leadSource,
      followUpCalls: row.followUpCalls,
      notes: row.notes,
      owner: row.owner,
      damageDetail: row.damageDetail,
      intentToClaim: row.intentToClaim,
      followUpDate: row.followUpDate?.toISOString() ?? null,
      additionalNote: row.additionalNote,
      latitude: row.latitude,
      longitude: row.longitude,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }
}
