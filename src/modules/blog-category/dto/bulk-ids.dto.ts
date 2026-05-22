import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export class BulkIdsDto extends createZodDto(BulkIdsSchema) {}
