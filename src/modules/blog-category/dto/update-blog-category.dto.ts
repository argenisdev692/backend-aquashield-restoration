import { z } from 'zod';
import { CreateBlogCategorySchema } from './create-blog-category.dto';

export const UpdateBlogCategorySchema = CreateBlogCategorySchema.partial();

export type UpdateBlogCategoryDto = z.infer<typeof UpdateBlogCategorySchema>;
