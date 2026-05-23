import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Body of `POST /users/:userId/permissions` — grant or deny a single
 * permission directly on a user, overriding the role-inherited ruleset.
 *
 * - `isGranted: true`  → extra ALLOW for `(action, subject)` on top of the
 *   user's roles.
 * - `isGranted: false` → explicit DENY that overrides any matching ALLOW
 *   inherited from the user's roles (see `CaslAbilityFactory` — the rule is
 *   loaded with `inverted: true` and CASL applies late-rule precedence).
 *
 * Optional `conditions` (CASL ABAC, MongoQuery-shaped) and `fields`
 * (Field-Level Security allowlist) narrow the override further.
 */
export const UpsertUserPermissionSchema = z.object({
  permissionId: z.string().uuid(),
  isGranted: z.boolean(),
  conditions: z.record(z.string(), z.unknown()).nullish(),
  fields: z.array(z.string().min(1).max(100)).max(50).optional(),
});

export class UpsertUserPermissionDto extends createZodDto(
  UpsertUserPermissionSchema,
) {}
