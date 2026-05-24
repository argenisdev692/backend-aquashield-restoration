import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ExportBackupsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf']).default('xlsx'),
});

export class ExportBackupsDto extends createZodDto(ExportBackupsSchema) {}

export type ExportBackupsInput = z.infer<typeof ExportBackupsSchema>;
