import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { phoneSchema } from '../../../../shared/phone/phone.util';

export const CreateAppointmentSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  // Validated against US/PT/ES; bare local numbers default to US.
  // Stored as E.164 (`+15550000000`).
  phone: phoneSchema,
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().min(1).max(255),
  address2: z.string().max(255).nullable().optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zipcode: z.string().min(1).max(20),
  country: z.string().min(1).max(100),
  insuranceProperty: z.boolean().default(false),
  message: z.string().nullable().optional(),
  smsConsent: z.boolean().default(false),
  registrationDate: z.string().datetime().nullable().optional(),
  inspectionDate: z.string().datetime().nullable().optional(),
  inspectionTime: z.string().datetime().nullable().optional(),
  inspectionStatus: z
    .enum(['Confirmed', 'Completed', 'Pending', 'Declined'])
    .nullable()
    .optional(),
  statusLead: z
    .enum(['New', 'Called', 'Pending', 'Declined'])
    .nullable()
    .optional(),
  leadSource: z
    .enum(['Website', 'FacebookAds', 'Reference', 'RetellAI'])
    .nullable()
    .optional(),
  followUpCalls: z.unknown().nullable().optional(),
  notes: z.string().nullable().optional(),
  owner: z.string().max(255).nullable().optional(),
  damageDetail: z.string().nullable().optional(),
  intentToClaim: z.boolean().nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  additionalNote: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export class CreateAppointmentDto extends createZodDto(
  CreateAppointmentSchema,
) {}

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
