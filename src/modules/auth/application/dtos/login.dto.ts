import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export class LoginDto extends createZodDto(LoginSchema) {}

export type LoginInput = z.infer<typeof LoginSchema>;
