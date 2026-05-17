import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ChangePasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
