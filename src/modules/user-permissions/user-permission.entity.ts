import type { Permission } from '../roles/roles.entity';

/**
 * A direct permission override attached to a single user. Wins over the
 * permission set inherited from roles thanks to the late-rule precedence
 * applied by `CaslAbilityFactory.createForUser` (direct rules are loaded
 * AFTER role rules, and `inverted: true` is set when `isGranted` is false).
 *
 * - `isGranted: true`  → extra ALLOW on top of what the roles already grant.
 * - `isGranted: false` → explicit DENY that overrides any matching ALLOW
 *                        inherited from the user's roles.
 */
export interface UserPermission {
  userId: string;
  permissionId: string;
  isGranted: boolean;
  conditions: Record<string, unknown> | null;
  fields: string[];
  assignedAt: Date;
  assignedBy: string | null;
  permission: Permission;
}
