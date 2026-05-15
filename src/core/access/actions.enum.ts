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
  | 'ACTIVITY_LOG'
  | 'ALL';

export type AppAbility = MongoAbility<[Action, Subjects]>;

/** Authenticated principal attached to the request by the JWT strategy. */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  roleIds: string[];
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
