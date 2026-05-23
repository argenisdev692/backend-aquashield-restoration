import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  stringBoolean,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../shared/crud/trashed.util';

export const RolesListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(255).optional(),
    ...trashedFlagsShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

export class RolesListQueryDto extends createZodDto(RolesListQuerySchema) {}

/** Single-get query — supports `withTrashed` only (Laravel `withTrashed()->find()`). */
export const GetRoleQuerySchema = z.object({
  withTrashed: stringBoolean.optional(),
});

export class GetRoleQueryDto extends createZodDto(GetRoleQuerySchema) {}
