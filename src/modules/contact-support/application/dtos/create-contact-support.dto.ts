import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateContactSupportSchema = z.object({
  firstName: z.string().min(2).max(255),
  lastName: z.string().min(2).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(5).max(20),
  subject: z.string().min(5).max(150),
  message: z.string().min(10).max(2000),
  smsConsent: z.boolean().default(false),
});

export class CreateContactSupportDto extends createZodDto(
  CreateContactSupportSchema,
) {}
