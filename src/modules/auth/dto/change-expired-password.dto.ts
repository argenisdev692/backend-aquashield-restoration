import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ChangeExpiredPasswordSchema = z
  .object({
    passwordChangeToken: z.string().min(10),
    newPassword: z.string().min(8).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((d) => d.newPassword === d.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export class ChangeExpiredPasswordDto extends createZodDto(
  ChangeExpiredPasswordSchema,
) {}

export type ChangeExpiredPasswordInput = z.infer<
  typeof ChangeExpiredPasswordSchema
>;
