import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateBlogCategorySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().min(5).max(255).optional(),
  image: z.string().url().max(500).optional(),
});

export class CreateBlogCategoryDto extends createZodDto(
  CreateBlogCategorySchema,
) {}
