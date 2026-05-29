import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ResendVerificationCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

export class ResendVerificationCodeDto extends createZodDto(
  ResendVerificationCodeSchema,
) {}
export type ResendVerificationCodeInput = z.infer<
  typeof ResendVerificationCodeSchema
>;
