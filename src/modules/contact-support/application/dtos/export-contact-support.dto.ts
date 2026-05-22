import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';

export const ExportContactSupportSchema = z
  .object({
    format: z.enum(['csv', 'pdf']).default('csv'),
    /** `true` → only read, `false` → only unread, omitted → all. */
    readed: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    ...trashedFlagsShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

export class ExportContactSupportDto extends createZodDto(
  ExportContactSupportSchema,
) {}
