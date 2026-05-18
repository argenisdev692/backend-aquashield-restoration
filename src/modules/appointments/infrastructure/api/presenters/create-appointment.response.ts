import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateAppointmentResponseSchema = z.object({
  id: z.string().uuid(),
});

export class CreateAppointmentResponse extends createZodDto(
  CreateAppointmentResponseSchema,
) {}
