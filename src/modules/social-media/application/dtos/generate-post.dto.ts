import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const NetworksSchema = z
  .object({
    facebook: z.boolean().optional(),
    instagram: z.boolean().optional(),
    tiktok: z.boolean().optional(),
    linkedin: z.boolean().optional(),
  })
  .refine(
    (val) =>
      val.facebook === true ||
      val.instagram === true ||
      val.tiktok === true ||
      val.linkedin === true,
    { message: 'At least one social network must be selected' },
  );

export const GeneratePostSchema = z.object({
  topicId: z.string().uuid().optional(),
  topic: z.object({
    title: z.string().min(3).max(500),
    description: z.string().min(10).max(2000),
  }),
  networks: NetworksSchema,
  language: z.string().min(2).max(10).optional().default('es'),
  saveToHistory: z.boolean().optional().default(true),
});

export class GeneratePostDto extends createZodDto(GeneratePostSchema) {}

export type GeneratePostInput = z.infer<typeof GeneratePostSchema>;
