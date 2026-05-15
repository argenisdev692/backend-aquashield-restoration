import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyOtpSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().length(4).regex(/^\d{4}$/),
  type: z.enum(['login', 'email_verify', 'password_reset']),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
