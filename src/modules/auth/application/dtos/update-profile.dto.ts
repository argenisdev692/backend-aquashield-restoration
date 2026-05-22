import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { phoneSchema } from '../../../../shared/phone/phone.util';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  username: z.string().min(3).max(255).optional(),
  // Validated against PT/US/ES; bare local numbers default to PT. Stored as E.164.
  phone: phoneSchema.optional(),
  dateOfBirth: z.coerce.date().optional(),
  address: z.string().max(255).optional(),
  address2: z.string().max(255).optional(),
  zipCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  gender: z
    .enum(['male', 'female', 'non_binary', 'prefer_not_to_say'])
    .optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
