import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyTwoFactorChallengeSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^\d{4,6}$/, 'Code must be 4 or 6 digits'),
  type: z.enum(['otp', 'totp']),
});

export class VerifyTwoFactorChallengeDto extends createZodDto(
  VerifyTwoFactorChallengeSchema,
) {}

export type VerifyTwoFactorChallengeInput = z.infer<
  typeof VerifyTwoFactorChallengeSchema
>;
