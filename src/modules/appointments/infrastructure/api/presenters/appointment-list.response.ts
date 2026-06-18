import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AppointmentResponseSchema } from './appointment.response';

export const AppointmentListResponseSchema = z.object({
  data: z.array(AppointmentResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class AppointmentListResponse extends createZodDto(
  AppointmentListResponseSchema,
) {}
