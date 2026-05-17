import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RequestPasswordChangeSchema = z.object({
  email: z.string().email().max(255),
});

export class RequestPasswordChangeDto extends createZodDto(
  RequestPasswordChangeSchema,
) {}

export type RequestPasswordChangeInput = z.infer<
  typeof RequestPasswordChangeSchema
>;
