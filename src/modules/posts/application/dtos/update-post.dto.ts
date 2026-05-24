import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CreatePostSchema } from './create-post.dto';

export const UpdatePostSchema = CreatePostSchema.partial();

export class UpdatePostDto extends createZodDto(UpdatePostSchema) {}

export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
