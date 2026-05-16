import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyTotpSchema = z.object({
  email: z.string().email().max(255),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export class VerifyTotpDto extends createZodDto(VerifyTotpSchema) {}

export type VerifyTotpInput = z.infer<typeof VerifyTotpSchema>;
