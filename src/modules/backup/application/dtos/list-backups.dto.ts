import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListBackupsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListBackupsQueryDto extends createZodDto(ListBackupsQuerySchema) {}
