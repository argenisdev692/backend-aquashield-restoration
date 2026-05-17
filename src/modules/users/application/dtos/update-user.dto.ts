import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  lastName: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
