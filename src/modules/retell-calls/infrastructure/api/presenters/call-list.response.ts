import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CallResponseSchema } from './call.response';

export const CallListResponseSchema = z.object({
  data: z.array(CallResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

export class CallListResponse extends createZodDto(CallListResponseSchema) {}
