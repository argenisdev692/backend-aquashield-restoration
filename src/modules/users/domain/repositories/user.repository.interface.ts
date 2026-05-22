import type { User } from '../entities/user.aggregate';
import type { TrashedMode } from '../../../../shared/crud/trashed.util';
import type { UserAccess } from '../../application/read-models/user.read-model';

export interface UserRow {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  password: string | null;
  emailVerifiedAt: Date | null;
  passwordConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserData {
  name: string;
  lastName?: string;
  email: string;
}

export interface UpdateUserData {
  name?: string;
  lastName?: string;
  email?: string;
}

export interface IUserRepository {
  /**
   * Look up a user by id.
   * @param trashed when `true`, soft-deleted users are returned too
   *                (Laravel `withTrashed()->find()`). Defaults to `false`.
   */
  findById(id: string, trashed?: boolean): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /**
   * Paginated list. `trashed` controls soft-delete visibility:
   *
   * - `exclude` (default) — only active users
   * - `include`           — active + suspended
   * - `only`              — only suspended
   */
  findAll(params: {
    skip: number;
    take: number;
    search?: string;
    trashed?: TrashedMode;
  }): Promise<{ users: User[]; total: number }>;
  create(user: User): Promise<User>;
  save(user: User): Promise<void>;
  softDelete(id: string): Promise<void>;
  existsByEmail(email: string, excludeId?: string): Promise<boolean>;
  existsByUsername(username: string, excludeId?: string): Promise<boolean>;
  /** Set-based soft delete — single SQL statement, idempotent. */
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  /** Set-based restore — single SQL statement, idempotent. */
  bulkRestore(ids: string[]): Promise<{ count: number }>;

  /**
   * Access projection for a single user — assigned roles + effective
   * permissions (union of role-inherited + direct grants, deduplicated by
   * `${action}:${subject}`). Returns empty arrays when the user has no
   * assignments. Never returns `null` — a missing user yields empty arrays
   * too; existence is the caller's concern.
   */
  findAccessByUserId(userId: string): Promise<UserAccess>;
  /**
   * Batched variant of {@link findAccessByUserId} for the list query.
   * Returns a `Map<userId, UserAccess>`. Missing user ids are absent from
   * the map — the caller must fall back to empty `{ roles: [], permissions: [] }`.
   * One round-trip per pivot table (user_roles + user_permissions), so
   * the cost is `O(2 SQL)` regardless of `userIds.length`.
   */
  findAccessByUserIds(userIds: string[]): Promise<Map<string, UserAccess>>;

  /**
   * Replace the full set of roles assigned to a user. Set-based:
   * one `deleteMany` followed by one `createMany`. MUST be called inside
   * the outer write transaction so a partial failure rolls back cleanly.
   * Passing `roleIds: []` removes every existing assignment.
   * @param assignedBy id of the actor performing the change (audit trail).
   */
  replaceRoles(
    userId: string,
    roleIds: string[],
    assignedBy: string,
  ): Promise<void>;
  /**
   * Replace the full set of DIRECT permission grants for a user
   * (`is_granted=true` rows). DENY rows are not modified by this call.
   * Same set-based + tx-bound semantics as {@link replaceRoles}.
   */
  replacePermissions(
    userId: string,
    permissionIds: string[],
    assignedBy: string,
  ): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
