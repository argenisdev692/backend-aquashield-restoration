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
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /**
   * Soft-delete tombstone. `null` for active requests; ISO timestamp when
   * the request has been suspended.
   */
  deletedAt: z.string().datetime().nullable(),
  /** Derived lifecycle status — `active` when `deletedAt` is null, else `suspended`. */
  status: z.enum(['active', 'suspended']),
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
