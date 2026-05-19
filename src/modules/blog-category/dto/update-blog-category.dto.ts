import { createZodDto } from 'nestjs-zod';
import { CreateBlogCategorySchema } from './create-blog-category.dto';

export const UpdateBlogCategorySchema = CreateBlogCategorySchema.partial();

export class UpdateBlogCategoryDto extends createZodDto(
  UpdateBlogCategorySchema,
) {}
