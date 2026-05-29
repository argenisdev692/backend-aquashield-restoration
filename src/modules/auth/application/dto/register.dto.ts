import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../domain/value-objects/password.vo';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(255),
  lastName: z.string().trim().max(255).optional(),
  email: z.string().trim().toLowerCase().email().max(255),
  // Full policy enforcement happens in the PlaintextPassword VO so the
  // domain owns the rule. Here we only cap length to keep the request body
  // small (OWASP API #4).
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  termsAndConditions: z.literal(true, {
    error: 'Terms and conditions must be accepted',
  }),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
export type RegisterInput = z.infer<typeof RegisterSchema>;
