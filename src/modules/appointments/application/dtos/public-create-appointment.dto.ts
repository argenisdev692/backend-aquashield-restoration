import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PublicCreateAppointmentSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().min(5).max(255),
  address2: z.string().max(255).nullable().optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zipcode: z.string().min(3).max(20),
  country: z.string().min(1).max(100),
  message: z.string().max(2000).nullable().optional(),
  smsConsent: z.boolean().default(false),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export class PublicCreateAppointmentDto extends createZodDto(
  PublicCreateAppointmentSchema,
) {}
