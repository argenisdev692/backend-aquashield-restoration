import type {
  ContactSupport as ContactSupportRow,
  Prisma,
} from '../../../../../generated/prisma/client';
import { ContactSupport } from '../../../domain/entities/contact-support.aggregate';
import type { ContactSupportReadModel } from '../../../domain/read-models/contact-support.read-model';

export class ContactSupportMapper {
  static toDomain(row: ContactSupportRow): ContactSupport {
    return ContactSupport.reconstitute(
      row.id,
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.subject,
      row.message,
      row.smsConsent,
      row.readed,
      row.deletedAt,
    );
  }

  static toPersistence(
    entity: ContactSupport,
  ): Prisma.ContactSupportUncheckedCreateInput {
    return {
      id: entity.id,
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      phone: entity.phone,
      subject: entity.subject,
      message: entity.message,
      smsConsent: entity.smsConsent,
      readed: entity.readed,
      deletedAt: entity.deletedAt,
    };
  }

  static toReadModel(row: ContactSupportRow): ContactSupportReadModel {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      message: row.message,
      smsConsent: row.smsConsent,
      readed: row.readed,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
