export interface Permission {
  id: string;
  name: string;
  description: string | null;
  module: string;
  subject: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Permission as attached to a role — includes the pivot's CASL ABAC
 * `conditions` and Field-Level Security `fields` overrides.
 */
export interface RolePermissionAssignment extends Permission {
  conditions: Record<string, unknown> | null;
  fields: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  permissions?: RolePermissionAssignment[];
}
