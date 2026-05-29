import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  // Length cap only — verification is done by IPasswordHasher.compare. Domain
  // password policy is enforced at register / change-password, not here.
  password: z.string().min(1).max(256),
});

export class LoginDto extends createZodDto(LoginSchema) {}
export type LoginInput = z.infer<typeof LoginSchema>;
