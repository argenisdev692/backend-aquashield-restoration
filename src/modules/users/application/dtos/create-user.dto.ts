import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { phoneSchema } from '../../../../shared/phone/phone.util';

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(255),
  lastName: z.string().max(255).optional(),
  email: z.string().email().max(255),
  // Optional. Validated against PT/US/ES; bare local numbers default to PT.
  // Stored as E.164 (`+351912345678`).
  phone: phoneSchema.optional(),
  /**
   * Optional role assignments. Sending the field — even as `[]` — triggers
   * the role-replacement path (and the `Action.Manage USER` CASL check on
   * the controller). Omitting it leaves role assignments untouched.
   * Hard cap mirrors OWASP API #4 unrestricted-resource-consumption.
   */
  roleIds: z.array(z.string().uuid()).max(20).optional(),
  /**
   * Optional direct permission grants. Same opt-in semantics as `roleIds`.
   */
  permissionIds: z.array(z.string().uuid()).max(100).optional(),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
