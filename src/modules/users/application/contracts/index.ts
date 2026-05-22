/**
 * Frontend contracts barrel — §15.
 *
 * Re-exports ONLY pure Zod-inferred types and response schemas that
 * React / Next.js clients can consume. ZERO dependency on NestJS,
 * Prisma, or any backend library.
 */

// ── Input payloads ────────────────────────────────────────────────
export type { CreateUserInput } from '../dtos/create-user.dto';
export type { UpdateUserInput } from '../dtos/update-user.dto';
export type { SetupPasswordInput } from '../dtos/setup-password.dto';
export type { RequestPasswordChangeInput } from '../dtos/request-password-change.dto';
export type { ChangePasswordInput } from '../dtos/change-password.dto';
export type { UsersListQuery } from '../dtos/users-list-query.dto';

// ── Read models ───────────────────────────────────────────────────
export type { UserReadModel } from '../read-models/user.read-model';

// ── Paginated response ───────────────────────────────────────────
export type { PaginatedUsers } from '../queries/handlers/get-users-list.handler';
