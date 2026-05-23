import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Single role-permission assignment with optional CASL ABAC overrides:
 *  - `conditions`: MongoQuery-shaped JSON object (e.g. `{ ownerId: '$user.id' }`),
 *    interpolated at runtime by `CaslAbilityFactory.interpolate`.
 *  - `fields`: Field-Level Security allowlist (≤ 50 entries to bound payload).
 */
export const RolePermissionAssignmentSchema = z.object({
  permissionId: z.string().uuid(),
  conditions: z.record(z.string(), z.unknown()).nullish(),
  fields: z.array(z.string().min(1).max(100)).max(50).optional(),
});

export type RolePermissionAssignmentInput = z.infer<
  typeof RolePermissionAssignmentSchema
>;

export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).nullish(),
  permissions: z.array(RolePermissionAssignmentSchema).max(100).default([]),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
