import type {
  UserRoleProjection,
  UserPermissionProjection,
} from '../../domain/projections/user-access.projection';

export type {
  UserRoleProjection,
  UserPermissionProjection,
  UserAccess,
} from '../../domain/projections/user-access.projection';

export interface UserReadModel {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  /** E.164 — present as stored, e.g. `+351912345678`. Presenters format pretty. */
  phone: string | null;
  emailVerifiedAt: Date | null;
  passwordConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Soft-delete tombstone. `null` for active users; ISO date when the user
   * is suspended. Always present in API responses so the frontend can
   * render a "Suspended" badge with `if (user.deletedAt) ...`.
   */
  deletedAt: Date | null;
  /** Assigned roles. Empty array (never null/absent) for users with no roles. */
  roles: UserRoleProjection[];
  /**
   * Effective permissions: union of role-inherited + direct grants,
   * deduplicated by `${action}:${subject}`. Empty array for users with no
   * permissions. Frontend builds its CASL `Ability` directly from this list.
   */
  permissions: UserPermissionProjection[];
}
