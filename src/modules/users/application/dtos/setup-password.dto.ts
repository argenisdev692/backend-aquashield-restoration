import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SetupPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export class SetupPasswordDto extends createZodDto(SetupPasswordSchema) {}

export type SetupPasswordInput = z.infer<typeof SetupPasswordSchema>;
