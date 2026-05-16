import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ResetPasswordSchema = z
  .object({
    resetToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, 'Code must be a 6-digit number'),
    email: z.string().email().max(255),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
