import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const VerifyTwoFactorChallengeSchema = z
  .object({
    email: z.string().email().max(255),
    /**
     * OTP/TOTP: 4 or 6 digits. Backup code: XXXX-XXXX base32-Crockford
     * (alphabet excludes 0/O/1/I/L). Format is checked here; cryptographic
     * verification happens in the use case.
     */
    code: z.string().min(4).max(20),
    type: z.enum(['otp', 'totp', 'backup_code']),
    /**
     * When true and the challenge succeeds, the response sets a signed
     * 30-day cookie that lets this device skip future 2FA prompts.
     */
    trustDevice: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'backup_code') {
      const normalized = data.code.replace(/[\s-]+/g, '');
      if (!/^[2-9A-HJ-NP-Z]{8}$/i.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['code'],
          message: 'Invalid backup code format',
        });
      }
      return;
    }
    if (!/^\d{4,6}$/.test(data.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Code must be 4 or 6 digits',
      });
    }
  });

export class VerifyTwoFactorChallengeDto extends createZodDto(
  VerifyTwoFactorChallengeSchema,
) {}

export type VerifyTwoFactorChallengeInput = z.infer<
  typeof VerifyTwoFactorChallengeSchema
>;
