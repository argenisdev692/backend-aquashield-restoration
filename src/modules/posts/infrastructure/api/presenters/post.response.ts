import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PostResponseSchema = z.object({
  id: z.string().uuid(),
  postTitle: z.string(),
  postTitleSlug: z.string(),
  postContent: z.string(),
  postExcerpt: z.string().nullable(),
  postCoverImage: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  metaKeywords: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  postStatus: z.enum(['draft', 'published', 'scheduled']),
  scheduledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  categoryName: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
});

export class PostResponse extends createZodDto(PostResponseSchema) {}
