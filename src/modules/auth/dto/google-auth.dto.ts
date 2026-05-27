import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1),
});

export class GoogleAuthDto extends createZodDto(GoogleAuthSchema) {}

export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;
