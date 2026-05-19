import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateBlogCategorySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(255).optional(),
  image: z.string().max(255).optional(),
});

export class CreateBlogCategoryDto extends createZodDto(
  CreateBlogCategorySchema,
) {}
