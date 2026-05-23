import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PermissionResponseSchema } from '../../roles/dto/role-response.dto';

/** Response shape for a single user-level permission override. */
export const UserPermissionResponseSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  isGranted: z.boolean(),
  conditions: z.record(z.string(), z.unknown()).nullable(),
  fields: z.array(z.string()),
  assignedAt: z.string().datetime(),
  assignedBy: z.string().uuid().nullable(),
  permission: PermissionResponseSchema,
});

export class UserPermissionResponseDto extends createZodDto(
  UserPermissionResponseSchema,
) {}
