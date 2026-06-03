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
  // Core roles
  { name: "super-admin", description: "Full access to everything. Cannot be deleted.",         isSystem: true  },
  { name: "admin",       description: "Administrative access with limited destructive actions", isSystem: false },
  { name: "manager",     description: "Manager with invoice and company permissions",          isSystem: false },
  { name: "editor",      description: "Can create and edit content and appointments",           isSystem: false },
  { name: "viewer",      description: "Read-only access across all modules",                    isSystem: false },
  // Business roles
  { name: "marketing-manager",      description: "Marketing manager role",                              isSystem: false },
  { name: "director-assistant",    description: "Director assistant role",                            isSystem: false },
  { name: "technical-supervisor",   description: "Technical supervisor role",                         isSystem: false },
  { name: "representation-company", description: "Representation company role",                      isSystem: false },
  { name: "public-company",        description: "Public company role",                               isSystem: false },
  { name: "external-operators",    description: "External operators role",                           isSystem: false },
  { name: "public-adjuster",       description: "Public adjuster role",                              isSystem: false },
  { name: "insurance-adjuster",    description: "Insurance adjuster role",                           isSystem: false },
  { name: "technical-services",    description: "Technical services role",                           isSystem: false },
  { name: "marketing",             description: "Marketing role",                                    isSystem: false },
  { name: "warehouse",             description: "Warehouse role",                                    isSystem: false },
  { name: "administrative",        description: "Administrative role",                               isSystem: false },
  { name: "collections",           description: "Collections role",                                  isSystem: false },
  { name: "reportes",              description: "Reports role",                                      isSystem: false },
  { name: "salesperson",           description: "Salesperson role",                                  isSystem: false },
  { name: "lead",                  description: "Lead role",                                         isSystem: false },
  { name: "employees",             description: "Employees role",                                    isSystem: false },
  { name: "client",                description: "Client role",                                       isSystem: false },
  { name: "contact",               description: "Contact role",                                      isSystem: false },
  { name: "spectator",             description: "Spectator role",                                    isSystem: false },
];

const PERMISSIONS: readonly PermissionSeed[] = [
  // users
  { name: "users:create",  module: "users",  subject: "USER",  action: "create",  description: "Create new users" },
  { name: "users:read",    module: "users",  subject: "USER",  action: "read",    description: "View users" },
  { name: "users:update",  module: "users",  subject: "USER",  action: "update",  description: "Edit users" },
  { name: "users:delete",  module: "users",  subject: "USER",  action: "delete",  description: "Soft-delete users" },
  { name: "users:restore", module: "users",  subject: "USER",  action: "restore", description: "Restore soft-deleted users" },
  // email-data
  { name: "email-data:create",  module: "email-data",  subject: "EMAIL_DATA",  action: "create",  description: "Create email data" },
  { name: "email-data:read",    module: "email-data",  subject: "EMAIL_DATA",  action: "read",    description: "View email data" },
  { name: "email-data:update",  module: "email-data",  subject: "EMAIL_DATA",  action: "update",  description: "Edit email data" },
  { name: "email-data:delete",  module: "email-data",  subject: "EMAIL_DATA",  action: "delete",  description: "Soft-delete email data" },
  { name: "email-data:restore", module: "email-data",  subject: "EMAIL_DATA",  action: "restore", description: "Restore soft-deleted email data" },
  // service-categories
  { name: "service-categories:create",  module: "service-categories",  subject: "SERVICE_CATEGORY",  action: "create",  description: "Create service categories" },
  { name: "service-categories:read",    module: "service-categories",  subject: "SERVICE_CATEGORY",  action: "read",    description: "View service categories" },
  { name: "service-categories:update",  module: "service-categories",  subject: "SERVICE_CATEGORY",  action: "update",  description: "Edit service categories" },
  { name: "service-categories:delete",  module: "service-categories",  subject: "SERVICE_CATEGORY",  action: "delete",  description: "Soft-delete service categories" },
  { name: "service-categories:restore", module: "service-categories",  subject: "SERVICE_CATEGORY",  action: "restore", description: "Restore soft-deleted service categories" },
  // portfolios
  { name: "portfolios:create",  module: "portfolios",  subject: "PORTFOLIO",  action: "create",  description: "Create portfolios" },
  { name: "portfolios:read",    module: "portfolios",  subject: "PORTFOLIO",  action: "read",    description: "View portfolios" },
  { name: "portfolios:update",  module: "portfolios",  subject: "PORTFOLIO",  action: "update",  description: "Edit portfolios" },
  { name: "portfolios:delete",  module: "portfolios",  subject: "PORTFOLIO",  action: "delete",  description: "Soft-delete portfolios" },
  { name: "portfolios:restore", module: "portfolios",  subject: "PORTFOLIO",  action: "restore", description: "Restore soft-deleted portfolios" },
  // project-types
  { name: "project-types:create",  module: "project-types",  subject: "PROJECT_TYPE",  action: "create",  description: "Create project types" },
  { name: "project-types:read",    module: "project-types",  subject: "PROJECT_TYPE",  action: "read",    description: "View project types" },
  { name: "project-types:update",  module: "project-types",  subject: "PROJECT_TYPE",  action: "update",  description: "Edit project types" },
  { name: "project-types:delete",  module: "project-types",  subject: "PROJECT_TYPE",  action: "delete",  description: "Soft-delete project types" },
  { name: "project-types:restore", module: "project-types",  subject: "PROJECT_TYPE",  action: "restore", description: "Restore soft-deleted project types" },
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
  { name: "contacts:create",  module: "contacts", subject: "CONTACT_SUPPORT", action: "create",  description: "Create contact support entries" },
  { name: "contacts:read",    module: "contacts", subject: "CONTACT_SUPPORT", action: "read",    description: "View contact support entries" },
  { name: "contacts:update",  module: "contacts", subject: "CONTACT_SUPPORT", action: "update",  description: "Edit contact support entries" },
  { name: "contacts:delete",  module: "contacts", subject: "CONTACT_SUPPORT", action: "delete",  description: "Soft-delete contact support entries" },
  { name: "contacts:restore", module: "contacts", subject: "CONTACT_SUPPORT", action: "restore", description: "Restore soft-deleted contact support entries" },
  // company (singleton — seeded once; only read/update endpoints exist)
  { name: "company:read",    module: "company", subject: "COMPANY", action: "read",    description: "View company data" },
  { name: "company:update",  module: "company", subject: "COMPANY", action: "update",  description: "Edit company data" },
  // blog-categories
  { name: "blog-categories:create",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "create",  description: "Create blog categories" },
  { name: "blog-categories:read",    module: "blog-categories", subject: "BLOG_CATEGORY", action: "read",    description: "View blog categories" },
  { name: "blog-categories:update",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "update",  description: "Edit blog categories" },
  { name: "blog-categories:delete",  module: "blog-categories", subject: "BLOG_CATEGORY", action: "delete",  description: "Soft-delete blog categories" },
  { name: "blog-categories:restore", module: "blog-categories", subject: "BLOG_CATEGORY", action: "restore", description: "Restore soft-deleted blog categories" },
  // posts
  { name: "posts:create",  module: "posts", subject: "POST", action: "create",  description: "Create posts" },
  { name: "posts:read",    module: "posts", subject: "POST", action: "read",    description: "View posts" },
  { name: "posts:update",  module: "posts", subject: "POST", action: "update",  description: "Edit posts" },
  { name: "posts:delete",  module: "posts", subject: "POST", action: "delete",  description: "Soft-delete posts" },
  { name: "posts:restore", module: "posts", subject: "POST", action: "restore", description: "Restore soft-deleted posts" },
  // seo
  { name: "seo:create",  module: "seo", subject: "SEO", action: "create",  description: "Create SEO entries" },
  { name: "seo:read",    module: "seo", subject: "SEO", action: "read",    description: "View SEO entries" },
  { name: "seo:update",  module: "seo", subject: "SEO", action: "update",  description: "Edit SEO entries" },
  { name: "seo:delete",  module: "seo", subject: "SEO", action: "delete",  description: "Soft-delete SEO entries" },
  { name: "seo:restore", module: "seo", subject: "SEO", action: "restore", description: "Restore soft-deleted SEO entries" },
  // call-records
  { name: "call-records:create",  module: "call-records", subject: "CALL_RECORD", action: "create",  description: "Create call records" },
  { name: "call-records:read",    module: "call-records", subject: "CALL_RECORD", action: "read",    description: "View call records" },
  { name: "call-records:update",  module: "call-records", subject: "CALL_RECORD", action: "update",  description: "Edit call records" },
  { name: "call-records:delete",  module: "call-records", subject: "CALL_RECORD", action: "delete",  description: "Soft-delete call records" },
  { name: "call-records:restore", module: "call-records", subject: "CALL_RECORD", action: "restore", description: "Restore soft-deleted call records" },
  // model-ai
  { name: "model-ai:create",  module: "model-ai", subject: "MODEL_AI", action: "create",  description: "Create AI models" },
  { name: "model-ai:read",    module: "model-ai", subject: "MODEL_AI", action: "read",    description: "View AI models" },
  { name: "model-ai:update",  module: "model-ai", subject: "MODEL_AI", action: "update",  description: "Edit AI models" },
  { name: "model-ai:delete",  module: "model-ai", subject: "MODEL_AI", action: "delete",  description: "Soft-delete AI models" },
  { name: "model-ai:restore", module: "model-ai", subject: "MODEL_AI", action: "restore", description: "Restore soft-deleted AI models" },
  // insurance-companies
  { name: "insurance-companies:create",  module: "insurance-companies", subject: "INSURANCE_COMPANY", action: "create",  description: "Create insurance companies" },
  { name: "insurance-companies:read",    module: "insurance-companies", subject: "INSURANCE_COMPANY", action: "read",    description: "View insurance companies" },
  { name: "insurance-companies:update",  module: "insurance-companies", subject: "INSURANCE_COMPANY", action: "update",  description: "Edit insurance companies" },
  { name: "insurance-companies:delete",  module: "insurance-companies", subject: "INSURANCE_COMPANY", action: "delete",  description: "Soft-delete insurance companies" },
  { name: "insurance-companies:restore", module: "insurance-companies", subject: "INSURANCE_COMPANY", action: "restore", description: "Restore soft-deleted insurance companies" },
  // invoice-demos
  { name: "invoice-demos:create",  module: "invoice-demos", subject: "INVOICE_DEMO", action: "create",  description: "Create invoice demos" },
  { name: "invoice-demos:read",    module: "invoice-demos", subject: "INVOICE_DEMO", action: "read",    description: "View invoice demos" },
  { name: "invoice-demos:update",  module: "invoice-demos", subject: "INVOICE_DEMO", action: "update",  description: "Edit invoice demos" },
  { name: "invoice-demos:delete",  module: "invoice-demos", subject: "INVOICE_DEMO", action: "delete",  description: "Soft-delete invoice demos" },
  { name: "invoice-demos:restore", module: "invoice-demos", subject: "INVOICE_DEMO", action: "restore", description: "Restore soft-deleted invoice demos" },
  // invoices
  { name: "invoices:create",  module: "invoices", subject: "INVOICE", action: "create",  description: "Create invoices" },
  { name: "invoices:read",    module: "invoices", subject: "INVOICE", action: "read",    description: "View invoices" },
  { name: "invoices:update",  module: "invoices", subject: "INVOICE", action: "update",  description: "Edit invoices" },
  { name: "invoices:delete",  module: "invoices", subject: "INVOICE", action: "delete",  description: "Soft-delete invoices" },
  { name: "invoices:restore", module: "invoices", subject: "INVOICE", action: "restore", description: "Restore soft-deleted invoices" },
  // public-companies
  { name: "public-companies:create",  module: "public-companies", subject: "PUBLIC_COMPANY", action: "create",  description: "Create public companies" },
  { name: "public-companies:read",    module: "public-companies", subject: "PUBLIC_COMPANY", action: "read",    description: "View public companies" },
  { name: "public-companies:update",  module: "public-companies", subject: "PUBLIC_COMPANY", action: "update",  description: "Edit public companies" },
  { name: "public-companies:delete",  module: "public-companies", subject: "PUBLIC_COMPANY", action: "delete",  description: "Soft-delete public companies" },
  { name: "public-companies:restore", module: "public-companies", subject: "PUBLIC_COMPANY", action: "restore", description: "Restore soft-deleted public companies" },
  // type-damages
  { name: "type-damages:create",  module: "type-damages", subject: "TYPE_DAMAGE", action: "create",  description: "Create type damages" },
  { name: "type-damages:read",    module: "type-damages", subject: "TYPE_DAMAGE", action: "read",    description: "View type damages" },
  { name: "type-damages:update",  module: "type-damages", subject: "TYPE_DAMAGE", action: "update",  description: "Edit type damages" },
  { name: "type-damages:delete",  module: "type-damages", subject: "TYPE_DAMAGE", action: "delete",  description: "Soft-delete type damages" },
  { name: "type-damages:restore", module: "type-damages", subject: "TYPE_DAMAGE", action: "restore", description: "Restore soft-deleted type damages" },
  // cause-of-losses
  { name: "cause-of-losses:create",  module: "cause-of-losses", subject: "CAUSE_OF_LOSS", action: "create",  description: "Create cause of losses" },
  { name: "cause-of-losses:read",    module: "cause-of-losses", subject: "CAUSE_OF_LOSS", action: "read",    description: "View cause of losses" },
  { name: "cause-of-losses:update",  module: "cause-of-losses", subject: "CAUSE_OF_LOSS", action: "update",  description: "Edit cause of losses" },
  { name: "cause-of-losses:delete",  module: "cause-of-losses", subject: "CAUSE_OF_LOSS", action: "delete",  description: "Soft-delete cause of losses" },
  { name: "cause-of-losses:restore", module: "cause-of-losses", subject: "CAUSE_OF_LOSS", action: "restore", description: "Restore soft-deleted cause of losses" },
  // claim-statuses
  { name: "claim-statuses:create",  module: "claim-statuses", subject: "CLAIM_STATU", action: "create",  description: "Create claim statuses" },
  { name: "claim-statuses:read",    module: "claim-statuses", subject: "CLAIM_STATU", action: "read",    description: "View claim statuses" },
  { name: "claim-statuses:update",  module: "claim-statuses", subject: "CLAIM_STATU", action: "update",  description: "Edit claim statuses" },
  { name: "claim-statuses:delete",  module: "claim-statuses", subject: "CLAIM_STATU", action: "delete",  description: "Soft-delete claim statuses" },
  { name: "claim-statuses:restore", module: "claim-statuses", subject: "CLAIM_STATU", action: "restore", description: "Restore soft-deleted claim statuses" },
  // alliance-companies
  { name: "alliance-companies:create",  module: "alliance-companies", subject: "ALLIANCE_COMPANY", action: "create",  description: "Create alliance companies" },
  { name: "alliance-companies:read",    module: "alliance-companies", subject: "ALLIANCE_COMPANY", action: "read",    description: "View alliance companies" },
  { name: "alliance-companies:update",  module: "alliance-companies", subject: "ALLIANCE_COMPANY", action: "update",  description: "Edit alliance companies" },
  { name: "alliance-companies:delete",  module: "alliance-companies", subject: "ALLIANCE_COMPANY", action: "delete",  description: "Soft-delete alliance companies" },
  { name: "alliance-companies:restore", module: "alliance-companies", subject: "ALLIANCE_COMPANY", action: "restore", description: "Restore soft-deleted alliance companies" },
  // zones
  { name: "zones:create",  module: "zones", subject: "ZONE", action: "create",  description: "Create zones" },
  { name: "zones:read",    module: "zones", subject: "ZONE", action: "read",    description: "View zones" },
  { name: "zones:update",  module: "zones", subject: "ZONE", action: "update",  description: "Edit zones" },
  { name: "zones:delete",  module: "zones", subject: "ZONE", action: "delete",  description: "Soft-delete zones" },
  { name: "zones:restore", module: "zones", subject: "ZONE", action: "restore", description: "Restore soft-deleted zones" },
  // category-products
  { name: "category-products:create",  module: "category-products", subject: "CATEGORY_PRODUCT", action: "create",  description: "Create category products" },
  { name: "category-products:read",    module: "category-products", subject: "CATEGORY_PRODUCT", action: "read",    description: "View category products" },
  { name: "category-products:update",  module: "category-products", subject: "CATEGORY_PRODUCT", action: "update",  description: "Edit category products" },
  { name: "category-products:delete",  module: "category-products", subject: "CATEGORY_PRODUCT", action: "delete",  description: "Soft-delete category products" },
  { name: "category-products:restore", module: "category-products", subject: "CATEGORY_PRODUCT", action: "restore", description: "Restore soft-deleted category products" },
  // claims
  { name: "claims:create",  module: "claims", subject: "CLAIM", action: "create",  description: "Create claims" },
  { name: "claims:read",    module: "claims", subject: "CLAIM", action: "read",    description: "View claims" },
  { name: "claims:update",  module: "claims", subject: "CLAIM", action: "update",  description: "Edit claims" },
  { name: "claims:delete",  module: "claims", subject: "CLAIM", action: "delete",  description: "Soft-delete claims" },
  { name: "claims:restore", module: "claims", subject: "CLAIM", action: "restore", description: "Restore soft-deleted claims" },
  // scope-sheets
  { name: "scope-sheets:create",  module: "scope-sheets", subject: "SCOPE_SHEET", action: "create",  description: "Create scope sheets" },
  { name: "scope-sheets:read",    module: "scope-sheets", subject: "SCOPE_SHEET", action: "read",    description: "View scope sheets" },
  { name: "scope-sheets:update",  module: "scope-sheets", subject: "SCOPE_SHEET", action: "update",  description: "Edit scope sheets" },
  { name: "scope-sheets:delete",  module: "scope-sheets", subject: "SCOPE_SHEET", action: "delete",  description: "Soft-delete scope sheets" },
  { name: "scope-sheets:restore", module: "scope-sheets", subject: "SCOPE_SHEET", action: "restore", description: "Restore soft-deleted scope sheets" },
  // managers
  { name: "managers:create",  module: "managers", subject: "MANAGER", action: "create",  description: "Create managers" },
  { name: "managers:read",    module: "managers", subject: "MANAGER", action: "read",    description: "View managers" },
  { name: "managers:update",  module: "managers", subject: "MANAGER", action: "update",  description: "Edit managers" },
  { name: "managers:delete",  module: "managers", subject: "MANAGER", action: "delete",  description: "Soft-delete managers" },
  { name: "managers:restore", module: "managers", subject: "MANAGER", action: "restore", description: "Restore soft-deleted managers" },
  // salespersons
  { name: "salespersons:create",  module: "salespersons", subject: "SALESPERSON", action: "create",  description: "Create salespersons" },
  { name: "salespersons:read",    module: "salespersons", subject: "SALESPERSON", action: "read",    description: "View salespersons" },
  { name: "salespersons:update",  module: "salespersons", subject: "SALESPERSON", action: "update",  description: "Edit salespersons" },
  { name: "salespersons:delete",  module: "salespersons", subject: "SALESPERSON", action: "delete",  description: "Soft-delete salespersons" },
  { name: "salespersons:restore", module: "salespersons", subject: "SALESPERSON", action: "restore", description: "Restore soft-deleted salespersons" },
  // marketing-managers
  { name: "marketing-managers:create",  module: "marketing-managers", subject: "MARKETING_MANAGER", action: "create",  description: "Create marketing managers" },
  { name: "marketing-managers:read",    module: "marketing-managers", subject: "MARKETING_MANAGER", action: "read",    description: "View marketing managers" },
  { name: "marketing-managers:update",  module: "marketing-managers", subject: "MARKETING_MANAGER", action: "update",  description: "Edit marketing managers" },
  { name: "marketing-managers:delete",  module: "marketing-managers", subject: "MARKETING_MANAGER", action: "delete",  description: "Soft-delete marketing managers" },
  { name: "marketing-managers:restore", module: "marketing-managers", subject: "MARKETING_MANAGER", action: "restore", description: "Restore soft-deleted marketing managers" },
  // director-assistants
  { name: "director-assistants:create",  module: "director-assistants", subject: "DIRECTOR_ASSISTANT", action: "create",  description: "Create director assistants" },
  { name: "director-assistants:read",    module: "director-assistants", subject: "DIRECTOR_ASSISTANT", action: "read",    description: "View director assistants" },
  { name: "director-assistants:update",  module: "director-assistants", subject: "DIRECTOR_ASSISTANT", action: "update",  description: "Edit director assistants" },
  { name: "director-assistants:delete",  module: "director-assistants", subject: "DIRECTOR_ASSISTANT", action: "delete",  description: "Soft-delete director assistants" },
  { name: "director-assistants:restore", module: "director-assistants", subject: "DIRECTOR_ASSISTANT", action: "restore", description: "Restore soft-deleted director assistants" },
  // technical-supervisors
  { name: "technical-supervisors:create",  module: "technical-supervisors", subject: "TECHNICAL_SUPERVISOR", action: "create",  description: "Create technical supervisors" },
  { name: "technical-supervisors:read",    module: "technical-supervisors", subject: "TECHNICAL_SUPERVISOR", action: "read",    description: "View technical supervisors" },
  { name: "technical-supervisors:update",  module: "technical-supervisors", subject: "TECHNICAL_SUPERVISOR", action: "update",  description: "Edit technical supervisors" },
  { name: "technical-supervisors:delete",  module: "technical-supervisors", subject: "TECHNICAL_SUPERVISOR", action: "delete",  description: "Soft-delete technical supervisors" },
  { name: "technical-supervisors:restore", module: "technical-supervisors", subject: "TECHNICAL_SUPERVISOR", action: "restore", description: "Restore soft-deleted technical supervisors" },
  // representation-companies
  { name: "representation-companies:create",  module: "representation-companies", subject: "REPRESENTATION_COMPANY", action: "create",  description: "Create representation companies" },
  { name: "representation-companies:read",    module: "representation-companies", subject: "REPRESENTATION_COMPANY", action: "read",    description: "View representation companies" },
  { name: "representation-companies:update",  module: "representation-companies", subject: "REPRESENTATION_COMPANY", action: "update",  description: "Edit representation companies" },
  { name: "representation-companies:delete",  module: "representation-companies", subject: "REPRESENTATION_COMPANY", action: "delete",  description: "Soft-delete representation companies" },
  { name: "representation-companies:restore", module: "representation-companies", subject: "REPRESENTATION_COMPANY", action: "restore", description: "Restore soft-deleted representation companies" },
  // external-operators
  { name: "external-operators:create",  module: "external-operators", subject: "EXTERNAL_OPERATORS", action: "create",  description: "Create external operators" },
  { name: "external-operators:read",    module: "external-operators", subject: "EXTERNAL_OPERATORS", action: "read",    description: "View external operators" },
  { name: "external-operators:update",  module: "external-operators", subject: "EXTERNAL_OPERATORS", action: "update",  description: "Edit external operators" },
  { name: "external-operators:delete",  module: "external-operators", subject: "EXTERNAL_OPERATORS", action: "delete",  description: "Soft-delete external operators" },
  { name: "external-operators:restore", module: "external-operators", subject: "EXTERNAL_OPERATORS", action: "restore", description: "Restore soft-deleted external operators" },
  // public-adjusters
  { name: "public-adjusters:create",  module: "public-adjusters", subject: "PUBLIC_ADJUSTER", action: "create",  description: "Create public adjusters" },
  { name: "public-adjusters:read",    module: "public-adjusters", subject: "PUBLIC_ADJUSTER", action: "read",    description: "View public adjusters" },
  { name: "public-adjusters:update",  module: "public-adjusters", subject: "PUBLIC_ADJUSTER", action: "update",  description: "Edit public adjusters" },
  { name: "public-adjusters:delete",  module: "public-adjusters", subject: "PUBLIC_ADJUSTER", action: "delete",  description: "Soft-delete public adjusters" },
  { name: "public-adjusters:restore", module: "public-adjusters", subject: "PUBLIC_ADJUSTER", action: "restore", description: "Restore soft-deleted public adjusters" },
  // insurance-adjusters
  { name: "insurance-adjusters:create",  module: "insurance-adjusters", subject: "INSURANCE_ADJUSTER", action: "create",  description: "Create insurance adjusters" },
  { name: "insurance-adjusters:read",    module: "insurance-adjusters", subject: "INSURANCE_ADJUSTER", action: "read",    description: "View insurance adjusters" },
  { name: "insurance-adjusters:update",  module: "insurance-adjusters", subject: "INSURANCE_ADJUSTER", action: "update",  description: "Edit insurance adjusters" },
  { name: "insurance-adjusters:delete",  module: "insurance-adjusters", subject: "INSURANCE_ADJUSTER", action: "delete",  description: "Soft-delete insurance adjusters" },
  { name: "insurance-adjusters:restore", module: "insurance-adjusters", subject: "INSURANCE_ADJUSTER", action: "restore", description: "Restore soft-deleted insurance adjusters" },
  // technical-services
  { name: "technical-services:create",  module: "technical-services", subject: "TECHNICAL_SERVICES", action: "create",  description: "Create technical services" },
  { name: "technical-services:read",    module: "technical-services", subject: "TECHNICAL_SERVICES", action: "read",    description: "View technical services" },
  { name: "technical-services:update",  module: "technical-services", subject: "TECHNICAL_SERVICES", action: "update",  description: "Edit technical services" },
  { name: "technical-services:delete",  module: "technical-services", subject: "TECHNICAL_SERVICES", action: "delete",  description: "Soft-delete technical services" },
  { name: "technical-services:restore", module: "technical-services", subject: "TECHNICAL_SERVICES", action: "restore", description: "Restore soft-deleted technical services" },
  // marketing-roles
  { name: "marketing-roles:create",  module: "marketing-roles", subject: "MARKETING", action: "create",  description: "Create marketing roles" },
  { name: "marketing-roles:read",    module: "marketing-roles", subject: "MARKETING", action: "read",    description: "View marketing roles" },
  { name: "marketing-roles:update",  module: "marketing-roles", subject: "MARKETING", action: "update",  description: "Edit marketing roles" },
  { name: "marketing-roles:delete",  module: "marketing-roles", subject: "MARKETING", action: "delete",  description: "Soft-delete marketing roles" },
  { name: "marketing-roles:restore", module: "marketing-roles", subject: "MARKETING", action: "restore", description: "Restore soft-deleted marketing roles" },
  // warehouse-roles
  { name: "warehouse-roles:create",  module: "warehouse-roles", subject: "WAREHOUSE", action: "create",  description: "Create warehouse roles" },
  { name: "warehouse-roles:read",    module: "warehouse-roles", subject: "WAREHOUSE", action: "read",    description: "View warehouse roles" },
  { name: "warehouse-roles:update",  module: "warehouse-roles", subject: "WAREHOUSE", action: "update",  description: "Edit warehouse roles" },
  { name: "warehouse-roles:delete",  module: "warehouse-roles", subject: "WAREHOUSE", action: "delete",  description: "Soft-delete warehouse roles" },
  { name: "warehouse-roles:restore", module: "warehouse-roles", subject: "WAREHOUSE", action: "restore", description: "Restore soft-deleted warehouse roles" },
  // administrative-roles
  { name: "administrative-roles:create",  module: "administrative-roles", subject: "ADMINISTRATIVE", action: "create",  description: "Create administrative roles" },
  { name: "administrative-roles:read",    module: "administrative-roles", subject: "ADMINISTRATIVE", action: "read",    description: "View administrative roles" },
  { name: "administrative-roles:update",  module: "administrative-roles", subject: "ADMINISTRATIVE", action: "update",  description: "Edit administrative roles" },
  { name: "administrative-roles:delete",  module: "administrative-roles", subject: "ADMINISTRATIVE", action: "delete",  description: "Soft-delete administrative roles" },
  { name: "administrative-roles:restore", module: "administrative-roles", subject: "ADMINISTRATIVE", action: "restore", description: "Restore soft-deleted administrative roles" },
  // collections-roles
  { name: "collections-roles:create",  module: "collections-roles", subject: "COLLECTIONS", action: "create",  description: "Create collections roles" },
  { name: "collections-roles:read",    module: "collections-roles", subject: "COLLECTIONS", action: "read",    description: "View collections roles" },
  { name: "collections-roles:update",  module: "collections-roles", subject: "COLLECTIONS", action: "update",  description: "Edit collections roles" },
  { name: "collections-roles:delete",  module: "collections-roles", subject: "COLLECTIONS", action: "delete",  description: "Soft-delete collections roles" },
  { name: "collections-roles:restore", module: "collections-roles", subject: "COLLECTIONS", action: "restore", description: "Restore soft-deleted collections roles" },
  // reportes-roles
  { name: "reportes-roles:create",  module: "reportes-roles", subject: "REPORTES", action: "create",  description: "Create reportes roles" },
  { name: "reportes-roles:read",    module: "reportes-roles", subject: "REPORTES", action: "read",    description: "View reportes roles" },
  { name: "reportes-roles:update",  module: "reportes-roles", subject: "REPORTES", action: "update",  description: "Edit reportes roles" },
  { name: "reportes-roles:delete",  module: "reportes-roles", subject: "REPORTES", action: "delete",  description: "Soft-delete reportes roles" },
  { name: "reportes-roles:restore", module: "reportes-roles", subject: "REPORTES", action: "restore", description: "Restore soft-deleted reportes roles" },
  // leads
  { name: "leads:create",  module: "leads", subject: "LEAD", action: "create",  description: "Create leads" },
  { name: "leads:read",    module: "leads", subject: "LEAD", action: "read",    description: "View leads" },
  { name: "leads:update",  module: "leads", subject: "LEAD", action: "update",  description: "Edit leads" },
  { name: "leads:delete",  module: "leads", subject: "LEAD", action: "delete",  description: "Soft-delete leads" },
  { name: "leads:restore", module: "leads", subject: "LEAD", action: "restore", description: "Restore soft-deleted leads" },
  // employees
  { name: "employees:create",  module: "employees", subject: "EMPLOYEES", action: "create",  description: "Create employees" },
  { name: "employees:read",    module: "employees", subject: "EMPLOYEES", action: "read",    description: "View employees" },
  { name: "employees:update",  module: "employees", subject: "EMPLOYEES", action: "update",  description: "Edit employees" },
  { name: "employees:delete",  module: "employees", subject: "EMPLOYEES", action: "delete",  description: "Soft-delete employees" },
  { name: "employees:restore", module: "employees", subject: "EMPLOYEES", action: "restore", description: "Restore soft-deleted employees" },
  // clients
  { name: "clients:create",  module: "clients", subject: "CLIENT", action: "create",  description: "Create clients" },
  { name: "clients:read",    module: "clients", subject: "CLIENT", action: "read",    description: "View clients" },
  { name: "clients:update",  module: "clients", subject: "CLIENT", action: "update",  description: "Edit clients" },
  { name: "clients:delete",  module: "clients", subject: "CLIENT", action: "delete",  description: "Soft-delete clients" },
  { name: "clients:restore", module: "clients", subject: "CLIENT", action: "restore", description: "Restore soft-deleted clients" },
  // contact-roles
  { name: "contact-roles:create",  module: "contact-roles", subject: "CONTACT", action: "create",  description: "Create contact roles" },
  { name: "contact-roles:read",    module: "contact-roles", subject: "CONTACT", action: "read",    description: "View contact roles" },
  { name: "contact-roles:update",  module: "contact-roles", subject: "CONTACT", action: "update",  description: "Edit contact roles" },
  { name: "contact-roles:delete",  module: "contact-roles", subject: "CONTACT", action: "delete",  description: "Soft-delete contact roles" },
  { name: "contact-roles:restore", module: "contact-roles", subject: "CONTACT", action: "restore", description: "Restore soft-deleted contact roles" },
  // spectators
  { name: "spectators:create",  module: "spectators", subject: "SPECTATOR", action: "create",  description: "Create spectators" },
  { name: "spectators:read",    module: "spectators", subject: "SPECTATOR", action: "read",    description: "View spectators" },
  { name: "spectators:update",  module: "spectators", subject: "SPECTATOR", action: "update",  description: "Edit spectators" },
  { name: "spectators:delete",  module: "spectators", subject: "SPECTATOR", action: "delete",  description: "Soft-delete spectators" },
  { name: "spectators:restore", module: "spectators", subject: "SPECTATOR", action: "restore", description: "Restore soft-deleted spectators" },
  // w9-forms
  { name: "w9-forms:create",  module: "w9-forms", subject: "W9FORM", action: "create",  description: "Create W9 forms" },
  { name: "w9-forms:read",    module: "w9-forms", subject: "W9FORM", action: "read",    description: "View W9 forms" },
  { name: "w9-forms:update",  module: "w9-forms", subject: "W9FORM", action: "update",  description: "Edit W9 forms" },
  { name: "w9-forms:delete",  module: "w9-forms", subject: "W9FORM", action: "delete",  description: "Soft-delete W9 forms" },
  { name: "w9-forms:restore", module: "w9-forms", subject: "W9FORM", action: "restore", description: "Restore soft-deleted W9 forms" },
  // salesperson-signatures
  { name: "salesperson-signatures:create",  module: "salesperson-signatures", subject: "SALESPERSON_SIGNATURE", action: "create",  description: "Create salesperson signatures" },
  { name: "salesperson-signatures:read",    module: "salesperson-signatures", subject: "SALESPERSON_SIGNATURE", action: "read",    description: "View salesperson signatures" },
  { name: "salesperson-signatures:update",  module: "salesperson-signatures", subject: "SALESPERSON_SIGNATURE", action: "update",  description: "Edit salesperson signatures" },
  { name: "salesperson-signatures:delete",  module: "salesperson-signatures", subject: "SALESPERSON_SIGNATURE", action: "delete",  description: "Soft-delete salesperson signatures" },
  { name: "salesperson-signatures:restore", module: "salesperson-signatures", subject: "SALESPERSON_SIGNATURE", action: "restore", description: "Restore soft-deleted salesperson signatures" },
  // service-requests
  { name: "service-requests:create",  module: "service-requests", subject: "SERVICE_REQUEST", action: "create",  description: "Create service requests" },
  { name: "service-requests:read",    module: "service-requests", subject: "SERVICE_REQUEST", action: "read",    description: "View service requests" },
  { name: "service-requests:update",  module: "service-requests", subject: "SERVICE_REQUEST", action: "update",  description: "Edit service requests" },
  { name: "service-requests:delete",  module: "service-requests", subject: "SERVICE_REQUEST", action: "delete",  description: "Soft-delete service requests" },
  { name: "service-requests:restore", module: "service-requests", subject: "SERVICE_REQUEST", action: "restore", description: "Restore soft-deleted service requests" },
  // products
  { name: "products:create",  module: "products", subject: "PRODUCT", action: "create",  description: "Create products" },
  { name: "products:read",    module: "products", subject: "PRODUCT", action: "read",    description: "View products" },
  { name: "products:update",  module: "products", subject: "PRODUCT", action: "update",  description: "Edit products" },
  { name: "products:delete",  module: "products", subject: "PRODUCT", action: "delete",  description: "Soft-delete products" },
  { name: "products:restore", module: "products", subject: "PRODUCT", action: "restore", description: "Restore soft-deleted products" },
  // mortgage-companies
  { name: "mortgage-companies:create",  module: "mortgage-companies", subject: "MORTGAGE_COMPANY", action: "create",  description: "Create mortgage companies" },
  { name: "mortgage-companies:read",    module: "mortgage-companies", subject: "MORTGAGE_COMPANY", action: "read",    description: "View mortgage companies" },
  { name: "mortgage-companies:update",  module: "mortgage-companies", subject: "MORTGAGE_COMPANY", action: "update",  description: "Edit mortgage companies" },
  { name: "mortgage-companies:delete",  module: "mortgage-companies", subject: "MORTGAGE_COMPANY", action: "delete",  description: "Soft-delete mortgage companies" },
  { name: "mortgage-companies:restore", module: "mortgage-companies", subject: "MORTGAGE_COMPANY", action: "restore", description: "Restore soft-deleted mortgage companies" },
  // customers
  { name: "customers:create",  module: "customers", subject: "CUSTOMER", action: "create",  description: "Create customers" },
  { name: "customers:read",    module: "customers", subject: "CUSTOMER", action: "read",    description: "View customers" },
  { name: "customers:update",  module: "customers", subject: "CUSTOMER", action: "update",  description: "Edit customers" },
  { name: "customers:delete",  module: "customers", subject: "CUSTOMER", action: "delete",  description: "Soft-delete customers" },
  { name: "customers:restore", module: "customers", subject: "CUSTOMER", action: "restore", description: "Restore soft-deleted customers" },
  // properties
  { name: "properties:create",  module: "properties", subject: "PROPERTIES", action: "create",  description: "Create properties" },
  { name: "properties:read",    module: "properties", subject: "PROPERTIES", action: "read",    description: "View properties" },
  { name: "properties:update",  module: "properties", subject: "PROPERTIES", action: "update",  description: "Edit properties" },
  { name: "properties:delete",  module: "properties", subject: "PROPERTIES", action: "delete",  description: "Soft-delete properties" },
  { name: "properties:restore", module: "properties", subject: "PROPERTIES", action: "restore", description: "Restore soft-deleted properties" },
  // database backups (super-admin only — granted via "ALL", never mapped to lower roles)
  { name: "database-backups:read",   module: "database-backups", subject: "DATABASE_BACKUP", action: "read",   description: "List and download database backups" },
  { name: "database-backups:create", module: "database-backups", subject: "DATABASE_BACKUP", action: "create", description: "Trigger a database backup manually" },
  { name: "database-backups:delete", module: "database-backups", subject: "DATABASE_BACKUP", action: "delete", description: "Delete a database backup from storage" },
  // social-media (super-admin only — AI-powered post generator for FB/IG/TT/LI; hard delete + export only)
  { name: "social-media:create", module: "social-media", subject: "SOCIAL_MEDIA", action: "create", description: "Generate social media posts via AI (topics + generate)" },
  { name: "social-media:read",   module: "social-media", subject: "SOCIAL_MEDIA", action: "read",   description: "View social media generation history" },
  { name: "social-media:delete", module: "social-media", subject: "SOCIAL_MEDIA", action: "delete", description: "Hard-delete social media generations (individual + bulk)" },
  { name: "social-media:export", module: "social-media", subject: "SOCIAL_MEDIA", action: "export", description: "Export social media generation history (csv/xlsx/pdf)" },
  // campaigns (super-admin only — expensive AI video ad export pipeline: Gemini + optional ElevenLabs + ZIP + PDF)
  { name: "campaigns:export", module: "campaigns", subject: "CAMPAIGN", action: "export", description: "Request and generate full campaign video exports (TOFU/MOFU/BOFU/LOYALTY) with AI assets" },
  { name: "campaigns:read",   module: "campaigns", subject: "CAMPAIGN", action: "read",   description: "View campaign export status and download links" },
  { name: "campaigns:delete", module: "campaigns", subject: "CAMPAIGN", action: "delete", description: "Hard-delete campaign generations (individual + bulk)" },
];

const ROLE_GRANTS: Readonly<Record<string, readonly string[] | "ALL">> = {
  "super-admin": "ALL",
  admin: [
    "users:create", "users:read", "users:update", "users:delete",
    "roles:read", "roles:assign",
    "permissions:read",
    "email-data:create", "email-data:read", "email-data:update", "email-data:delete", "email-data:restore",
    "content:create", "content:read", "content:update", "content:delete", "content:publish",
    "appointments:create", "appointments:read", "appointments:update", "appointments:delete",
    "contacts:create", "contacts:read", "contacts:update", "contacts:delete",
    "blog-categories:create", "blog-categories:read", "blog-categories:update", "blog-categories:delete", "blog-categories:restore",
    "call-records:create", "call-records:read", "call-records:update", "call-records:delete",
    // company:* is intentionally excluded — super-admin only
  ],
  manager: [
    // Email data permissions
    "email-data:create", "email-data:read", "email-data:update", "email-data:delete", "email-data:restore",
    // Invoice Demo permissions
    "invoice-demos:create", "invoice-demos:read", "invoice-demos:update", "invoice-demos:delete", "invoice-demos:restore",
    // Invoice permissions
    "invoices:create", "invoices:read", "invoices:update", "invoices:delete", "invoices:restore",
    // Insurance Company permissions
    "insurance-companies:create", "insurance-companies:read", "insurance-companies:update", "insurance-companies:delete", "insurance-companies:restore",
    // Public Company permissions
    "public-companies:create", "public-companies:read", "public-companies:update", "public-companies:delete", "public-companies:restore",
    // Type Damage permissions
    "type-damages:create", "type-damages:read", "type-damages:update", "type-damages:delete", "type-damages:restore",
    // Cause of Loss permissions
    "cause-of-losses:create", "cause-of-losses:read", "cause-of-losses:update", "cause-of-losses:delete", "cause-of-losses:restore",
    // Claim permissions
    "claims:create", "claims:read", "claims:update", "claims:delete", "claims:restore",
    // Public Adjuster permissions
    "public-adjusters:create", "public-adjusters:read", "public-adjusters:update", "public-adjusters:delete", "public-adjusters:restore",
    // Product permissions
    "products:create", "products:read", "products:update", "products:delete", "products:restore",
    // Service Category permissions
    "service-categories:create", "service-categories:read", "service-categories:update", "service-categories:delete", "service-categories:restore",
    // Service Request permissions
    "service-requests:create", "service-requests:read", "service-requests:update", "service-requests:delete", "service-requests:restore",
    // W9 Form permissions
    "w9-forms:create", "w9-forms:read", "w9-forms:update", "w9-forms:delete", "w9-forms:restore",
    // Category Product permissions
    "category-products:create", "category-products:read", "category-products:update", "category-products:delete", "category-products:restore",
    // Claim Status permissions
    "claim-statuses:create", "claim-statuses:read", "claim-statuses:update", "claim-statuses:delete", "claim-statuses:restore",
    // Alliance Company permissions
    "alliance-companies:create", "alliance-companies:read", "alliance-companies:update", "alliance-companies:delete", "alliance-companies:restore",
    // Salesperson Signature permissions
    "salesperson-signatures:create", "salesperson-signatures:read", "salesperson-signatures:update", "salesperson-signatures:delete", "salesperson-signatures:restore",
    // Mortgage Company permissions
    "mortgage-companies:create", "mortgage-companies:read", "mortgage-companies:update", "mortgage-companies:delete", "mortgage-companies:restore",
    // Manager permissions
    "managers:create", "managers:read", "managers:update", "managers:delete", "managers:restore",
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
  "marketing-manager": [
    "marketing-managers:create", "marketing-managers:read", "marketing-managers:update", "marketing-managers:delete", "marketing-managers:restore",
  ],
  "director-assistant": [
    "director-assistants:create", "director-assistants:read", "director-assistants:update", "director-assistants:delete", "director-assistants:restore",
  ],
  "technical-supervisor": [
    "technical-supervisors:create", "technical-supervisors:read", "technical-supervisors:update", "technical-supervisors:delete", "technical-supervisors:restore",
  ],
  "representation-company": [
    "representation-companies:create", "representation-companies:read", "representation-companies:update", "representation-companies:delete", "representation-companies:restore",
  ],
  "public-company": [
    "public-companies:create", "public-companies:read", "public-companies:update", "public-companies:delete", "public-companies:restore",
  ],
  "external-operators": [
    "external-operators:create", "external-operators:read", "external-operators:update", "external-operators:delete", "external-operators:restore",
  ],
  "public-adjuster": [
    "public-adjusters:create", "public-adjusters:read", "public-adjusters:update", "public-adjusters:delete", "public-adjusters:restore",
  ],
  "insurance-adjuster": [
    "insurance-adjusters:create", "insurance-adjusters:read", "insurance-adjusters:update", "insurance-adjusters:delete", "insurance-adjusters:restore",
  ],
  "technical-services": [
    "technical-services:create", "technical-services:read", "technical-services:update", "technical-services:delete", "technical-services:restore",
  ],
  marketing: [
    "marketing-roles:create", "marketing-roles:read", "marketing-roles:update", "marketing-roles:delete", "marketing-roles:restore",
  ],
  warehouse: [
    "warehouse-roles:create", "warehouse-roles:read", "warehouse-roles:update", "warehouse-roles:delete", "warehouse-roles:restore",
  ],
  administrative: [
    "administrative-roles:create", "administrative-roles:read", "administrative-roles:update", "administrative-roles:delete", "administrative-roles:restore",
  ],
  collections: [
    "collections-roles:create", "collections-roles:read", "collections-roles:update", "collections-roles:delete", "collections-roles:restore",
  ],
  reportes: [
    "reportes-roles:create", "reportes-roles:read", "reportes-roles:update", "reportes-roles:delete", "reportes-roles:restore",
  ],
  salesperson: [
    "salespersons:create", "salespersons:read", "salespersons:update", "salespersons:delete", "salespersons:restore",
  ],
  lead: [
    "leads:create", "leads:read", "leads:update", "leads:delete", "leads:restore",
  ],
  employees: [
    "employees:create", "employees:read", "employees:update", "employees:delete", "employees:restore",
  ],
  client: [
    "clients:create", "clients:read", "clients:update", "clients:delete", "clients:restore",
  ],
  contact: [
    "contact-roles:create", "contact-roles:read", "contact-roles:update", "contact-roles:delete", "contact-roles:restore",
  ],
  spectator: [
    "spectators:create", "spectators:read", "spectators:update", "spectators:delete", "spectators:restore",
  ],
};

type BlogCategorySeed = Readonly<{
  name: string;
  description: string;
  image: string | null;
}>;

const BLOG_CATEGORIES: readonly BlogCategorySeed[] = [
  { name: "Roofing", description: "Valor por defecto", image: "Valor por defecto" },
  { name: "Water Mitigation", description: "Categoría para contenido relacionado con mitigación de agua", image: "Valor por defecto" },
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
  { name: "Victor", lastName: "Lara", username: "aquashieldrestorationusa", email: "info@aquashieldrestorationusa.com", password: "info01=", role: "super-admin" },
  { name: "Argenis", lastName: "Gonzalez", username: "argenis.gonzalez", email: "argenis692@gmail.com", password: "argenis01=", role: "super-admin" },
  { name: "Admin",   lastName: "User",     username: "adminAppointment",    email: "admin@aquashieldrestorationusa.com",   password: "admin01=",   role: "admin"       },
  { name: "Manager", lastName: "User",     username: "manager01",           email: "manager@aquashieldrestorationusa.com", password: "manager01=", role: "manager"     },
  { name: "Editor",  lastName: "User",     username: "editor",              email: "editor@example.com",                  password: "editor01=",  role: "editor"      },
  { name: "Viewer",  lastName: "User",     username: "viewer",              email: "viewer@example.com",                  password: "viewer01=",  role: "viewer"      },
  { name: "Marketing", lastName: "Manager", username: "marketingmanager01",  email: "marketingmanager@aquashieldrestorationusa.com", password: "marketingmanager01=", role: "marketing-manager" },
  { name: "Director", lastName: "Assistant", username: "directorassistant01", email: "directorassistant@aquashieldrestorationusa.com", password: "directorassistant01=", role: "director-assistant" },
  { name: "Technical", lastName: "Supervisor", username: "technicalsupervisor01", email: "technicalsupervisor@aquashieldrestorationusa.com", password: "technicalsupervisor01=", role: "technical-supervisor" },
  { name: "Representation", lastName: "Company", username: "representationcompany01", email: "representationcompany@aquashieldrestorationusa.com", password: "representationcompany01=", role: "representation-company" },
  { name: "Public", lastName: "Company", username: "publiccompany01", email: "publiccompany@aquashieldrestorationusa.com", password: "publiccompany01=", role: "public-company" },
  { name: "External", lastName: "Operators", username: "externaloperators01", email: "externaloperators@aquashieldrestorationusa.com", password: "externaloperators01=", role: "external-operators" },
  { name: "Public", lastName: "Adjuster", username: "publicadjuster01", email: "publicadjuster@aquashieldrestorationusa.com", password: "publicadjuster01=", role: "public-adjuster" },
  { name: "Insurance", lastName: "Adjuster", username: "insuranceadjuster01", email: "insuranceadjuster@aquashieldrestorationusa.com", password: "insuranceadjuster01=", role: "insurance-adjuster" },
  { name: "Technical", lastName: "Services", username: "technicalservices01", email: "technicalservices@aquashieldrestorationusa.com", password: "technicalservices01=", role: "technical-services" },
  { name: "Marketing", lastName: "User", username: "marketing01", email: "marketing@aquashieldrestorationusa.com", password: "marketing01=", role: "marketing" },
  { name: "Warehouse", lastName: "User", username: "warehouse01", email: "warehouse@aquashieldrestorationusa.com", password: "warehouse01=", role: "warehouse" },
  { name: "Administrative", lastName: "User", username: "administrative01", email: "administrative@aquashieldrestorationusa.com", password: "administrative01=", role: "administrative" },
  { name: "Collections", lastName: "User", username: "collections01", email: "collections@aquashieldrestorationusa.com", password: "collections01=", role: "collections" },
  { name: "Reportes", lastName: "User", username: "reportes01", email: "reportes@aquashieldrestorationusa.com", password: "reportes01=", role: "reportes" },
  { name: "Sales", lastName: "Person", username: "salesperson01", email: "salesperson@aquashieldrestorationusa.com", password: "salesperson01=", role: "salesperson" },
  { name: "Lead", lastName: "User", username: "lead01", email: "lead@aquashieldrestorationusa.com", password: "lead01=", role: "lead" },
  { name: "Employee", lastName: "User", username: "employees01", email: "employees@aquashieldrestorationusa.com", password: "employees01=", role: "employees" },
  { name: "Client", lastName: "User", username: "client01", email: "client@aquashieldrestorationusa.com", password: "client01=", role: "client" },
  { name: "Contact", lastName: "User", username: "contact01", email: "contact@aquashieldrestorationusa.com", password: "contact01=", role: "contact" },
  { name: "Spectator", lastName: "User", username: "spectator01", email: "spectator@aquashieldrestorationusa.com", password: "spectator01=", role: "spectator" },
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
      update: { 
        name: "Victor Lara", 
        companyName: "Aquashield Restoration USA",
        email: "info@aquashieldrestorationusa.com",
        phone: "+17135876423",
        address: "3733 Westheimer Rd. Ste 1-4583, Houston, TX 77027",
        website: "https://aquashieldrestorationusa.com",
        latitude: 29.75516,
        longitude: -95.3984135,
        facebookLink: "https://www.facebook.com/aquashieldrestorationusa/",
        instagramLink: "https://www.instagram.com/aquashieldrestorationusa/",
        linkedinLink: "https://www.linkedin.com/company/v-general-contractors/",
        twitterLink: "https://twitter.com/aquashieldrestorationusa",
      },
      create: { 
        name: "Victor Lara", 
        companyName: "Aquashield Restoration USA",
        email: "info@aquashieldrestorationusa.com",
        phone: "+17135876423",
        address: "3733 Westheimer Rd. Ste 1-4583, Houston, TX 77027",
        website: "https://aquashieldrestorationusa.com",
        latitude: 29.75516,
        longitude: -95.3984135,
        facebookLink: "https://www.facebook.com/aquashieldrestorationusa/",
        instagramLink: "https://www.instagram.com/aquashieldrestorationusa/",
        linkedinLink: "https://www.linkedin.com/company/v-general-contractors/",
        twitterLink: "https://twitter.com/aquashieldrestorationusa",
        userId: superAdminUser.id,
      },
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
