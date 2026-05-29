import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
