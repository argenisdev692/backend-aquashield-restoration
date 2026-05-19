import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AppointmentResponseSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string(),
  address2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zipcode: z.string(),
  country: z.string(),
  message: z.string().nullable(),
  smsConsent: z.boolean(),
  registrationDate: z.string().datetime().nullable(),
  statusLead: z.string().nullable(),
  followUpCalls: z.unknown().nullable(),
  notes: z.string().nullable(),
  owner: z.string().nullable(),
  additionalNote: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  readed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export class AppointmentResponse extends createZodDto(
  AppointmentResponseSchema,
) {}
