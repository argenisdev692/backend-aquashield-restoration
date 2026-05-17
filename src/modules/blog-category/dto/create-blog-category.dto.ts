import { z } from 'zod';

export const CreateBlogCategorySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(255).optional(),
  image: z.string().max(255).optional(),
});

export type CreateBlogCategoryDto = z.infer<typeof CreateBlogCategorySchema>;
