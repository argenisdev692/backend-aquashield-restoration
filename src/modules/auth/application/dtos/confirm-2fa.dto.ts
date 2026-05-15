import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const Confirm2faSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export class Confirm2faDto extends createZodDto(Confirm2faSchema) {}

export type Confirm2faInput = z.infer<typeof Confirm2faSchema>;
