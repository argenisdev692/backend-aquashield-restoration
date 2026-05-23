/* eslint-disable no-console */
// ============================================================
//  prisma/seed.ts — idempotent dev seeder
//
//  Run via:
//    npx prisma db seed
//
//  Stack:
//    - PrismaClient generated under src/generated/prisma
//    - @prisma/adapter-pg driver adapter (pg under the hood)
//    - bcrypt for password hashing (cost = BCRYPT_ROUNDS || 10)
//
//  Strategy:
//    Every block uses `upsert` (or createMany with skipDuplicates) so
//    rerunning the seed is a no-op once data exists.
// ============================================================

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";

import { PrismaClient } from "../src/generated/prisma/client";

// ------------------------------------------------------------
//  Static seed data
// ------------------------------------------------------------

type RoleSeed = Readonly<{ name: string; description: string; isSystem: boolean }>;
type PermissionSeed = Readonly<{
  name: string;
  module: string;
  subject: string;
  action: string;
  description: string;
}>;

const ROLES: readonly RoleSeed[] = [
  { name: "super-admin", description: "Full access to everything. Cannot be deleted.",         isSystem: true  },
  { name: "admin",       description: "Administrative access with limited destructive actions", isSystem: false },
  { name: "editor",      description: "Can create and edit content and appointments",           isSystem: false },
  { name: "viewer",      description: "Read-only access across all modules",                    isSystem: false },
];

const PERMISSIONS: readonly PermissionSeed[] = [
  // users
  { name: "users:create",  module: "users",  subject: "USER",  action: "create",  description: "Create new users" },
  { name: "users:read",    module: "users",  subject: "USER",  action: "read",    description: "View users" },
  { name: "users:update",  module: "users",  subject: "USER",  action: "update",  description: "Edit users" },
  { name: "users:delete",  module: "users",  subject: "USER",  action: "delete",  description: "Soft-delete users" },
  { name: "users:restore", module: "users",  subject: "USER",  action: "restore", description: "Restore soft-deleted users" },
  // roles
  { name: "roles:create",  module: "roles",  subject: "ROLE",  action: "create",  description: "Create new roles" },
  { name: "roles:read",    module: "roles",  subject: "ROLE",  action: "read",    description: "View roles" },
  { name: "roles:update",  module: "roles",  subject: "ROLE",  action: "update",  description: "Edit roles" },
  { name: "roles:delete",  module: "roles",  subject: "ROLE",  action: "delete",  description: "Soft-delete roles" },
  { name: "roles:assign",  module: "roles",  subject: "ROLE",  action: "assign",  description: "Assign roles to users" },
  { name: "roles:restore", module: "roles",  subject: "ROLE",  action: "restore", description: "Restore soft-deleted roles" },
  // permissions (catalog — read-only; gated separately from ROLE so a future "list my perms" use case can grant it without role-admin access)
  { name: "permissions:read", module: "permissions", subject: "PERMISSION", action: "read", description: "View the permission catalog" },
  // content
  { name: "content:create",  module: "content", subject: "CONTENT", action: "create",  description: "Create content" },
  { name: "content:read",    module: "content", subject: "CONTENT", action: "read",    description: "View content" },
  { name: "content:update",  module: "content", subject: "CONTENT", action: "update",  description: "Edit content" },
  { name: "content:delete",  module: "content", subject: "CONTENT", action: "delete",  description: "Soft-delete content" },
  { name: "content:publish", module: "content", subject: "CONTENT", action: "publish", description: "Publish content" },
  { name: "content:restore", module: "content", subject: "CONTENT", action: "restore", description: "Restore soft-deleted content" },
  // appointments
  { name: "appointments:create",  module: "appointments", subject: "APPOINTMENT", action: "create",  description: "Create appointments" },
  { name: "appointments:read",    module: "appointments", subject: "APPOINTMENT", action: "read",    description: "View appointments" },
  { name: "appointments:update",  module: "appointments", subject: "APPOINTMENT", action: "update",  description: "Edit appointments" },
  { name: "appointments:delete",  module: "appointments", subject: "APPOINTMENT", action: "delete",  description: "Soft-delete appointments" },
  { name: "appointments:restore", module: "appointments", subject: "APPOINTMENT", action: "restore", description: "Restore soft-deleted appointments" },
  // contacts
  { name: "contacts:create",  module: "contacts", subject: "CONTACT", action: "create",  description: "Create contact support entries" },
  { name: "contacts:read",    module: "contacts", subject: "CONTACT", action: "read",    description: "View contact support entries" },
  { name: "contacts:update",  module: "contacts", subject: "CONTACT", action: "update",  description: "Edit contact support entries" },
  { name: "contacts:delete",  module: "contacts", subject: "CONTACT", action: "delete",  description: "Soft-delete contact support entries" },
  { name: "contacts:restore", module: "contacts", subject: "CONTACT", action: "restore", description: "Restore soft-deleted contact support entries" },
  // company (singleton — seeded once; only read/update endpoints exist)
  { name: "company:read",    module: "company", subject: "COMPANY", action: "read",    description: "View company data" },
  { name: "company:update",  module: "company", subject: "COMPANY", action: "update",  description: "Edit company data" },
  // blog-categories
  { name: "blog-categories:create",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "create",  description: "Create blog categories" },
  { name: "blog-categories:read",    module: "blog-categories", subject: "BLOG_CATEGORY", action: "read",    description: "View blog categories" },
  { name: "blog-categories:update",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "update",  description: "Edit blog categories" },
  { name: "blog-categories:delete",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "delete",  description: "Soft-delete blog categories" },
  { name: "blog-categories:restore", module: "blog-categories", subject: "BLOG_CATEGORY", action: "restore", description: "Restore soft-deleted blog categories" },
];

const ROLE_GRANTS: Readonly<Record<string, readonly string[] | "ALL">> = {
  "super-admin": "ALL",
  admin: [
    "users:create", "users:read", "users:update", "users:delete",
    "roles:read", "roles:assign",
    "permissions:read",
    "content:create", "content:read", "content:update", "content:delete", "content:publish",
    "appointments:create", "appointments:read", "appointments:update", "appointments:delete",
    "contacts:create", "contacts:read", "contacts:update", "contacts:delete",
    "blog-categories:create", "blog-categories:read", "blog-categories:update", "blog-categories:delete", "blog-categories:restore",
    // company:* is intentionally excluded — super-admin only
  ],
  editor: [
    "users:read",
    "content:create", "content:read", "content:update",
    "appointments:create", "appointments:read", "appointments:update",
    "contacts:read",
    "blog-categories:create", "blog-categories:read", "blog-categories:update",
    // company:* is intentionally excluded — super-admin only
  ],
  viewer: [
    "users:read",
    "content:read",
    "appointments:read",
    "contacts:read",
    "blog-categories:read",
    // company:* is intentionally excluded — super-admin only
  ],
};

type BlogCategorySeed = Readonly<{
  name: string;
  description: string;
  image: string | null;
}>;

const BLOG_CATEGORIES: readonly BlogCategorySeed[] = [
  { name: "AI",              description: "Artificial Intelligence trends, tools and insights",               image: null },
  { name: "Software",        description: "Software development, engineering and best practices",              image: null },
  { name: "Marketing Online", description: "Digital marketing strategies, SEO and content marketing",          image: null },
  { name: "Social Network",  description: "Social media platforms, networking and community building",         image: null },
];

type UserSeed = Readonly<{
  name: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: string;
}>;

const USERS: readonly UserSeed[] = [
  { name: "Argenis", lastName: "Gonzalez", username: "argenis.gonzalez", email: "argenis692@gmail.com", password: "argenis01=", role: "super-admin" },
  { name: "Admin",   lastName: "User",     username: "admin",            email: "admin@example.com",   password: "admin123=",   role: "admin"       },
  { name: "Editor",  lastName: "User",     username: "editor",           email: "editor@example.com",  password: "editor123=",  role: "editor"      },
  { name: "Viewer",  lastName: "User",     username: "viewer",           email: "viewer@example.com",  password: "viewer123=",  role: "viewer"      },
];

// ------------------------------------------------------------
//  Bootstrap
// ------------------------------------------------------------

function buildPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for prisma/seed.ts");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function main(): Promise<void> {
  const prisma = buildPrisma();
  const bcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS ?? "10", 10);

  try {
    console.log("→ seeding roles…");
    for (const role of ROLES) {
      await prisma.role.upsert({
        where:  { name: role.name },
        update: { description: role.description, isSystem: role.isSystem },
        create: { name: role.name, description: role.description, isSystem: role.isSystem },
      });
    }

    console.log("→ seeding permissions…");
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where:  { name: perm.name },
        update: { description: perm.description, module: perm.module, subject: perm.subject, action: perm.action },
        create: { ...perm },
      });
    }

    console.log("→ wiring role → permissions…");
    const allPermissions = await prisma.permission.findMany({ select: { id: true, name: true } });
    const permByName = new Map(allPermissions.map((p) => [p.name, p.id]));

    for (const [roleName, grant] of Object.entries(ROLE_GRANTS)) {
      const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
      if (!role) throw new Error(`Role '${roleName}' missing after seeding`);

      const permissionIds =
        grant === "ALL"
          ? allPermissions.map((p) => p.id)
          : grant.map((name) => {
              const id = permByName.get(name);
              if (!id) throw new Error(`Permission '${name}' missing for role '${roleName}'`);
              return id;
            });

      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    console.log("→ seeding users + role assignments…");
    // First pass: upsert users, hashing passwords.
    for (const u of USERS) {
      const hashed = await bcrypt.hash(u.password, bcryptRounds);
      await prisma.user.upsert({
        where:  { email: u.email },
        update: {
          name: u.name, lastName: u.lastName, username: u.username,
          password: hashed, termsAndConditions: true, emailVerifiedAt: new Date(),
        },
        create: {
          name: u.name, lastName: u.lastName, username: u.username,
          email: u.email, password: hashed,
          termsAndConditions: true, emailVerifiedAt: new Date(),
        },
      });
    }

    // Resolve the super-admin id so we can record it as assigned_by for the rest.
    const superAdminUser = await prisma.user.findUnique({
      where: { email: USERS[0]!.email },
      select: { id: true },
    });
    if (!superAdminUser) throw new Error("Super-admin user missing after seeding");

    // Second pass: wire user_roles.
    for (const u of USERS) {
      const user = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
      const role = await prisma.role.findUnique({ where: { name: u.role }, select: { id: true } });
      if (!user || !role) throw new Error(`User or role missing for '${u.email}' / '${u.role}'`);

      await prisma.userRole.upsert({
        where:  { userId_roleId: { userId: user.id, roleId: role.id } },
        update: { assignedBy: superAdminUser.id },
        create: { userId: user.id, roleId: role.id, assignedBy: superAdminUser.id },
      });
    }

    console.log("→ seeding company_data…");
    await prisma.companyData.upsert({
      where:  { userId: superAdminUser.id },
      update: { name: "Argenis Gonzalez", companyName: "Argenis Gonzalez" },
      create: { name: "Argenis Gonzalez", companyName: "Argenis Gonzalez", userId: superAdminUser.id },
    });

    console.log("→ seeding blog_categories…");
    for (const cat of BLOG_CATEGORIES) {
      const existing = await prisma.blogCategory.findFirst({
        where: { name: cat.name, deletedAt: null },
      });
      if (!existing) {
        await prisma.blogCategory.create({
          data: { name: cat.name, description: cat.description, image: cat.image, userId: superAdminUser.id },
        });
      }
    }

    console.log("✓ seed complete");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
