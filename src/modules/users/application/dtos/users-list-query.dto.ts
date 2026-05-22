import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';

export const UsersListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(255).optional(),
    // Laravel-style soft-delete visibility (default: only active rows).
    // `withTrashed=true` includes suspended; `onlyTrashed=true` returns
    // suspended-only. Reused as-is by the export endpoint.
    ...trashedFlagsShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

export class UsersListQueryDto extends createZodDto(UsersListQuerySchema) {}

export type UsersListQuery = z.infer<typeof UsersListQuerySchema>;
