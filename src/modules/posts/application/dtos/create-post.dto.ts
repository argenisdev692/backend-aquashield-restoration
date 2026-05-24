import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePostSchema = z.object({
  postTitle: z.string().min(1).max(255),
  postTitleSlug: z.string().max(255).optional(),
  postContent: z.string().min(1),
  postExcerpt: z.string().max(500).nullable().optional(),
  postCoverImage: z.string().max(2048).nullable().optional(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  metaKeywords: z.string().max(255).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  postStatus: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  scheduledAt: z.coerce.date().nullable().optional(),
}).refine(
  (data) => {
    if (data.postStatus === 'scheduled' && !data.scheduledAt) {
      return false;
    }
    return true;
  },
  {
    message: 'scheduledAt date is required when post status is scheduled',
    path: ['scheduledAt'],
  }
).refine(
  (data) => {
    if (data.postStatus === 'scheduled' && data.scheduledAt && data.scheduledAt.getTime() <= Date.now()) {
      return false;
    }
    return true;
  },
  {
    message: 'scheduledAt date must be in the future',
    path: ['scheduledAt'],
  }
).refine(
  (data) => {
    if (data.postStatus === 'scheduled' && data.scheduledAt) {
      const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (data.scheduledAt.getTime() < minDate.getTime()) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'scheduledAt must be at least 24 hours in the future',
    path: ['scheduledAt'],
  }
);

export class CreatePostDto extends createZodDto(CreatePostSchema) {}

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
