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
