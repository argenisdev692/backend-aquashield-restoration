import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PostResponseSchema } from './post.response';

export const PostListResponseSchema = z.object({
  data: z.array(PostResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class PostListResponse extends createZodDto(PostListResponseSchema) {}
