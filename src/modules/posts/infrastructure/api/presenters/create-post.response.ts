import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePostResponseSchema = z.object({
  id: z.string().uuid(),
});

export class CreatePostResponse extends createZodDto(CreatePostResponseSchema) {}
