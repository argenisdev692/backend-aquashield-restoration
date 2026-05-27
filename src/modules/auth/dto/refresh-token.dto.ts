import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(64).max(512),
});

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
