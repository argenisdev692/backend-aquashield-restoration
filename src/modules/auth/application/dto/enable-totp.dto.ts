import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const EnableTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export class EnableTotpDto extends createZodDto(EnableTotpSchema) {}
export type EnableTotpInput = z.infer<typeof EnableTotpSchema>;
