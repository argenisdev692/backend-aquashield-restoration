import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginResponseSchema = z.object({
  requiresOtp: z.boolean(),
  requiresTotp: z.boolean(),
  requiresPasswordChange: z.boolean().optional(),
  passwordChangeToken: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
});

export class LoginResponse extends createZodDto(LoginResponseSchema) {}

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export class TokenResponse extends createZodDto(TokenResponseSchema) {}

/**
 * `verify-otp` is a step in a possibly two-factor flow: it either issues
 * tokens or signals that a TOTP second factor is still required. The shape
 * is explicit so clients never have to infer state from empty token strings.
 */
export const VerifyOtpResponseSchema = z.object({
  requiresTotp: z.boolean(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
});

export class VerifyOtpResponse extends createZodDto(VerifyOtpResponseSchema) {}

export const TwoFactorSetupResponseSchema = z.object({
  secret: z.string(),
  qrCodeUri: z.string(),
});

export class TwoFactorSetupResponse extends createZodDto(
  TwoFactorSetupResponseSchema,
) {}

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export class MessageResponse extends createZodDto(MessageResponseSchema) {}

export const RegisterResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  message: z.string(),
});

export class RegisterResponse extends createZodDto(RegisterResponseSchema) {}

export const ResetTokenValidationResponseSchema = z.object({
  valid: z.boolean(),
});

export class ResetTokenValidationResponse extends createZodDto(
  ResetTokenValidationResponseSchema,
) {}

export const EmailVerificationStatusResponseSchema = z.object({
  verified: z.boolean(),
  verifiedAt: z.string().datetime().nullable(),
});

export class EmailVerificationStatusResponse extends createZodDto(
  EmailVerificationStatusResponseSchema,
) {}

export const PasswordConfirmationStatusResponseSchema = z.object({
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime().nullable(),
});

export class PasswordConfirmationStatusResponse extends createZodDto(
  PasswordConfirmationStatusResponseSchema,
) {}

export const TwoFactorChallengeInfoResponseSchema = z.object({
  email: z.string().email(),
  challengeType: z.enum(['otp', 'totp', 'none']),
  message: z.string(),
});

export class TwoFactorChallengeInfoResponse extends createZodDto(
  TwoFactorChallengeInfoResponseSchema,
) {}

export const TwoFactorChallengeResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export class TwoFactorChallengeResponse extends createZodDto(
  TwoFactorChallengeResponseSchema,
) {}

export const MeRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const MePermissionSchema = z.object({
  action: z.string(),
  subject: z.string(),
});

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  address: z.string().nullable(),
  address2: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  gender: z.string().nullable(),
  profilePhotoPath: z.string().nullable(),
  emailVerified: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
  totpEnabled: z.boolean(),
  passwordConfirmed: z.boolean(),
  hasGoogleAuth: z.boolean(),
  roles: z.array(MeRoleSchema),
  permissions: z.array(MePermissionSchema),
  createdAt: z.string().datetime(),
});

export class MeResponse extends createZodDto(MeResponseSchema) {}

export const ForgotPasswordResponseSchema = z.object({
  resetToken: z.string(),
  message: z.string(),
});

export class ForgotPasswordResponse extends createZodDto(
  ForgotPasswordResponseSchema,
) {}

export const GoogleAuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  isNewUser: z.boolean(),
});

export class GoogleAuthResponse extends createZodDto(GoogleAuthResponseSchema) {}
