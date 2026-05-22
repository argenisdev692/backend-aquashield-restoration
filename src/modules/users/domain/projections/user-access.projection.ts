/**
 * Role assignment as projected on a user read-model. Mirrors `MeRoleSchema`
 * from the auth presenter — same shape, deliberately duplicated as a TS
 * type so the read-model layer has no compile-time dependency on auth.
 */
export interface UserRoleProjection {
  id: string;
  name: string;
}

/**
 * Effective permission row — `{ action, subject }`, deduplicated across
 * role-inherited and direct grants. Mirrors `MePermissionSchema`.
 */
export interface UserPermissionProjection {
  action: string;
  subject: string;
}

/**
 * Access projection for a user — assigned roles + effective permissions
 * (union of role-inherited + direct grants, deduplicated by
 * `${action}:${subject}`). Returned by `IUserRepository.findAccessByUserId`
 * and the batched `findAccessByUserIds` used by the list query.
 *
 * Lives in `domain/` so `domain/repositories/user.repository.interface.ts`
 * can reference it without importing from `application/` — preserving the
 * hexagonal dependency rule (domain → nothing).
 */
export interface UserAccess {
  roles: UserRoleProjection[];
  permissions: UserPermissionProjection[];
}
