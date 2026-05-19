import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListContactSupportSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** `true` → only read, `false` → only unread, omitted → all. */
  readed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export class ListContactSupportDto extends createZodDto(
  ListContactSupportSchema,
) {}
