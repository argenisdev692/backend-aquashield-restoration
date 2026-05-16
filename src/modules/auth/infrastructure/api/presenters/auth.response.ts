import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginResponseSchema = z.object({
  requiresOtp: z.boolean(),
  requiresTotp: z.boolean(),
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
