import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ConfirmPasswordSchema = z.object({
  password: z.string().min(1).max(128),
});

export class ConfirmPasswordDto extends createZodDto(ConfirmPasswordSchema) {}

export type ConfirmPasswordInput = z.infer<typeof ConfirmPasswordSchema>;
