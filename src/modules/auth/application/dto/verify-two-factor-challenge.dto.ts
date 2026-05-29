import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Body for `POST /auth/two-factor/verify`. The caller MUST already hold the
 * mid-challenge access token (`tfa:false`) in the Authorization header.
 *
 * Either `code` (TOTP) or `backupCode` is required, never both at the same
 * time — guarded with `.refine`.
 */
export const VerifyTwoFactorChallengeSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/).optional(),
    backupCode: z.string().min(8).max(20).optional(),
    /** When true, persist a 30-day "trust this device" cookie. */
    trustDevice: z.boolean().default(false),
  })
  .refine(
    (v) =>
      (v.code !== undefined && v.backupCode === undefined) ||
      (v.code === undefined && v.backupCode !== undefined),
    { message: 'Provide either `code` or `backupCode`, not both' },
  );

export class VerifyTwoFactorChallengeDto extends createZodDto(
  VerifyTwoFactorChallengeSchema,
) {}
export type VerifyTwoFactorChallengeInput = z.infer<
  typeof VerifyTwoFactorChallengeSchema
>;
