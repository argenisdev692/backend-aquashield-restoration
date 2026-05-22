import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { phoneSchema } from '../../../../shared/phone/phone.util';

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    lastName: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    // Validated against PT/US/ES; bare local numbers default to PT. Stored as E.164.
    phone: phoneSchema.optional(),
    /**
     * Replace the full set of role assignments. Sending `[]` removes every
     * role from the user — that's the explicit opt-out path. Omitting the
     * field leaves existing assignments untouched. Triggers the
     * `Action.Manage USER` CASL check on the controller.
     */
    roleIds: z.array(z.string().uuid()).max(20).optional(),
    /**
     * Replace the full set of direct permission grants (deny rows ignored
     * by the read projection). Same REPLACE semantics as `roleIds`.
     */
    permissionIds: z.array(z.string().uuid()).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
