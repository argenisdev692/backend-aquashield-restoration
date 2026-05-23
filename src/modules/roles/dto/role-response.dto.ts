import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PermissionResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  module: z.string(),
  subject: z.string(),
  action: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export class PermissionResponseDto extends createZodDto(
  PermissionResponseSchema,
) {}

/**
 * Role's permission assignment — catalog fields + the pivot's ABAC overrides.
 * `conditions` is the (uninterpolated) MongoQuery JSON; `fields` is the FLS
 * allowlist (empty array when no override).
 */
export const RolePermissionAssignmentResponseSchema =
  PermissionResponseSchema.extend({
    conditions: z.record(z.string(), z.unknown()).nullable(),
    fields: z.array(z.string()),
  });

export class RolePermissionAssignmentResponseDto extends createZodDto(
  RolePermissionAssignmentResponseSchema,
) {}

export const RoleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  permissions: z.array(RolePermissionAssignmentResponseSchema).optional(),
});

export class RoleResponseDto extends createZodDto(RoleResponseSchema) {}
