import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../domain/value-objects/password.vo';

export const ResetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
