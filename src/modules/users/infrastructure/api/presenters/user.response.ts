import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  MeRoleSchema,
  MePermissionSchema,
} from '../../../../auth/application/presenters/auth.response';

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  /**
   * Phone in international pretty format, e.g. `+351 912 345 678`,
   * `+1 415 555 2671`, `+34 612 34 56 78`. `null` when the user has no phone.
   * Underlying storage is E.164 (`+351912345678`).
   */
  phone: z.string().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  passwordConfirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /**
   * Soft-delete tombstone. `null` for active users; ISO timestamp when the
   * user is suspended. Frontend renders a "Suspended" badge whenever this
   * field is non-null.
   */
  deletedAt: z.string().datetime().nullable(),
  /** Assigned roles. Always emitted — empty array for users with no roles. */
  roles: z.array(MeRoleSchema),
  /**
   * Effective permissions: role-inherited + direct grants, deduplicated by
   * `${action}:${subject}`. Frontend builds its CASL `Ability` from this
   * list — never walk `role.permissions[]` client-side.
   */
  permissions: z.array(MePermissionSchema),
});

export class UserResponse extends createZodDto(UserResponseSchema) {}

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export class MessageResponse extends createZodDto(MessageResponseSchema) {}

export const UserListResponseSchema = z.object({
  data: z.array(UserResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class UserListResponse extends createZodDto(UserListResponseSchema) {}
