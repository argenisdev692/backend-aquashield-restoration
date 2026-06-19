import type { MongoAbility } from '@casl/ability';

/** CASL actions — mirrors the `action` column in the `permissions` table. */
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Restore = 'restore',
  Publish = 'publish',
  Assign = 'assign',
  Export = 'export',
}

/** CASL subjects — mirrors the `subject` column in the `permissions` table. */
export type Subjects =
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'APPOINTMENT'
  | 'COMPANY'
  | 'CONTACT'
  | 'CONTENT'
  | 'BLOG_CATEGORY'
  | 'ACTIVITY_LOG'
  | 'DATABASE_BACKUP'
  | 'SOCIAL_MEDIA'
  | 'CAMPAIGN'
  | 'CALL_RECORD'
  | 'ALL';

export type AppAbility = MongoAbility<[Action, Subjects]>;

/** Authenticated principal attached to the request by the JWT strategy. */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  roleIds: string[];
  /**
   * Lowercase role names from the JWT. Lets `CaslAbilityFactory` short-circuit
   * for built-in roles (e.g. `super-admin`) without a DB hit. Empty for
   * legacy tokens issued before the field was embedded.
   */
  roleNames: string[];
  /**
   * AuthSession id (auth_sessions row) from the JWT `sid` claim. Lets logout
   * and session-revocation use-cases target the exact calling session
   * without scanning the user's sessions. Optional for legacy tokens.
   */
  sessionId?: string;
  /**
   * `true` when the access token was issued after a 2FA challenge OR for an
   * account that does not have 2FA enabled. Used by `TwoFactorRequiredGuard`
   * to block sensitive routes while a user is mid-challenge.
   */
  twoFactorSatisfied?: boolean;
}

/** Raw permission row shape shared by both repository queries. */
export interface PermissionRow {
  action: string;
  subject: string;
  conditions: Record<string, unknown> | null;
  fields: string[] | null;
}

export interface UserPermissionRow extends PermissionRow {
  /** Maps to `user_permissions.is_granted` — false = explicit DENY. */
  isGranted: boolean;
}
