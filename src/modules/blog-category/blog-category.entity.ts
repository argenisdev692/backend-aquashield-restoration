import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BlogCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255).nullable(),
  description: z.string().max(255).nullable(),
  image: z.string().max(255).nullable(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type BlogCategory = z.infer<typeof BlogCategorySchema>;

export const BlogCategoryResponseSchema = BlogCategorySchema;
export class BlogCategoryResponse extends createZodDto(BlogCategoryResponseSchema) {}
