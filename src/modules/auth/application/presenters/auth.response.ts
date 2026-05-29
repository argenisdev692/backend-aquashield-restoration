import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Canonical shape for the role projection inside identity responses.
 * Single source of truth — every module that returns roles MUST import
 * this schema (the project rules block redefinition).
 */
export const MeRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
});
export type MeRole = z.infer<typeof MeRoleSchema>;

/**
 * Flat, deduplicated permission projection — the frontend MUST NOT walk
 * `role.permissions[]`; it consumes this list directly.
 */
export const MePermissionSchema = z.object({
  action: z.string(),
  subject: z.string(),
});
export type MePermission = z.infer<typeof MePermissionSchema>;

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  // Identity + profile (read-only here; mutate via PATCH /auth/me).
  name: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  address: z.string().nullable(),
  address2: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  gender: z.string().nullable(),
  profilePhotoUrl: z.string().nullable(),
  // Security state.
  totpEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
  // Access.
  roles: z.array(MeRoleSchema),
  permissions: z.array(MePermissionSchema),
});
export class MeResponseDto extends createZodDto(MeResponseSchema) {}
export type MeResponse = z.infer<typeof MeResponseSchema>;

/**
 * Final response of a fully-authenticated login: access + refresh tokens.
 * The mid-2FA-challenge response uses `TwoFactorChallengeResponseSchema`.
 */
export const AuthTokensResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string(),
  twoFactorRequired: z.literal(false),
  /**
   * `true` when the user's password has expired (PASSWORD_EXPIRES_DAYS
   * elapsed since the last change). The frontend MUST redirect to
   * `/auth/change-password`; sensitive routes should refuse to operate
   * while the flag is set.
   */
  mustChangePassword: z.boolean(),
  /** ISO date of expiry, or null when expiry is disabled (TTL = 0). */
  passwordExpiresAt: z.string().datetime().nullable(),
});
export class AuthTokensResponseDto extends createZodDto(
  AuthTokensResponseSchema,
) {}
export type AuthTokensResponse = z.infer<typeof AuthTokensResponseSchema>;

/**
 * Response returned when credentials validated but the account has 2FA
 * enabled — the client must call /two-factor/verify with the TOTP code
 * (or backup code) carrying the returned `accessToken` (tfa:false claim).
 */
export const TwoFactorChallengeResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  twoFactorRequired: z.literal(true),
  // Backup codes the user has left — surfaces low-count in the UI.
  backupCodesRemaining: z.number().int().min(0),
  mustChangePassword: z.boolean(),
  passwordExpiresAt: z.string().datetime().nullable(),
});
export class TwoFactorChallengeResponseDto extends createZodDto(
  TwoFactorChallengeResponseSchema,
) {}
export type TwoFactorChallengeResponse = z.infer<
  typeof TwoFactorChallengeResponseSchema
>;

export const RegisterResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  verificationCodeExpiresInMinutes: z.number().int().positive(),
});
export class RegisterResponseDto extends createZodDto(RegisterResponseSchema) {}
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
