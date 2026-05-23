import { createZodDto } from 'nestjs-zod';
import { RolePermissionAssignmentSchema } from './create-role.dto';

/**
 * Body of `POST /roles/:id/permissions` — attach (or upsert) a single
 * permission to a role with optional ABAC overrides.
 */
export const AttachPermissionSchema = RolePermissionAssignmentSchema;

export class AttachPermissionDto extends createZodDto(AttachPermissionSchema) {}
