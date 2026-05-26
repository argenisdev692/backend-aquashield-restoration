import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateAppointmentSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().min(1).max(255).optional(),
  address2: z.string().max(255).nullable().optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  zipcode: z.string().min(1).max(20).optional(),
  country: z.string().min(1).max(100).optional(),
  message: z.string().nullable().optional(),
  smsConsent: z.boolean().optional(),
  registrationDate: z.string().datetime().nullable().optional(),
  statusLead: z
    .enum(['New', 'Called', 'Pending', 'Declined'])
    .nullable()
    .optional(),
  followUpCalls: z.unknown().nullable().optional(),
  notes: z.string().nullable().optional(),
  owner: z.string().max(255).nullable().optional(),
  additionalNote: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export class UpdateAppointmentDto extends createZodDto(
  UpdateAppointmentSchema,
) {}

export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
