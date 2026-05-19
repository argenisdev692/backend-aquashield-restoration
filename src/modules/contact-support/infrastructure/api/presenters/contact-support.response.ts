import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ContactSupportResponseSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  subject: z.string(),
  message: z.string(),
  smsConsent: z.boolean(),
  readed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ContactSupportResponse extends createZodDto(
  ContactSupportResponseSchema,
) {}

export const ContactSupportListResponseSchema = z.object({
  data: z.array(ContactSupportResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export class ContactSupportListResponse extends createZodDto(
  ContactSupportListResponseSchema,
) {}

export const CreateContactSupportResponseSchema = z.object({
  id: z.string().uuid(),
});

export class CreateContactSupportResponse extends createZodDto(
  CreateContactSupportResponseSchema,
) {}
