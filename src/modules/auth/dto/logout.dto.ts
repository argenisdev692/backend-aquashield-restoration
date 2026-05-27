import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LogoutSchema = z.object({
  refreshToken: z.string().min(64).max(512).optional(),
});

export class LogoutDto extends createZodDto(LogoutSchema) {}

export type LogoutInput = z.infer<typeof LogoutSchema>;
