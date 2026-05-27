import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RequestPasswordResetSchema = z.object({
  email: z.string().email().max(255),
});

export class RequestPasswordResetDto extends createZodDto(
  RequestPasswordResetSchema,
) {}

export type RequestPasswordResetInput = z.infer<
  typeof RequestPasswordResetSchema
>;
