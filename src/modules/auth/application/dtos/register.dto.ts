import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  passwordConfirmation: z.string(),
  termsAndConditions: z.boolean().refine((v) => v === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export type RegisterInput = z.infer<typeof RegisterSchema>;
