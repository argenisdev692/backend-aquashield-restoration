import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { phoneSchema } from '../../../../shared/phone/phone.util';

/**
 * Self-service profile update — WHITELIST only. Email / password / roles /
 * permissions / totp* / locked* are NOT here on purpose — those have their
 * own dedicated endpoints with extra guards (fresh-password, OTP, etc.).
 * Username is editable but unique-checked at the DB layer.
 */
export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    lastName: z.string().trim().max(255).nullable().optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(255)
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        'Username may only contain letters, digits, ., _ and -',
      )
      .nullable()
      .optional(),
    phone: phoneSchema.nullable().optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .nullable()
      .optional(),
    address: z.string().trim().max(255).nullable().optional(),
    address2: z.string().trim().max(255).nullable().optional(),
    zipCode: z.string().trim().max(20).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    gender: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say'])
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
