import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../domain/value-objects/password.vo';

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
