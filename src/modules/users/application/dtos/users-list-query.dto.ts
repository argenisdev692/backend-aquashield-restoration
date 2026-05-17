import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UsersListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
});

export class UsersListQueryDto extends createZodDto(UsersListQuerySchema) {}

export type UsersListQuery = z.infer<typeof UsersListQuerySchema>;
