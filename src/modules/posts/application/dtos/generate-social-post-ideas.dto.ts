import { z } from 'zod';

export const GenerateSocialPostIdeasSchema = z.object({
  niche: z.string().min(1, 'Niche is required'),
  audience: z.string().optional(),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  goal: z.string().optional(),
  voice: z.string().optional(),
  company: z.string().optional(),
  provider: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
});

export type GenerateSocialPostIdeasDto = z.infer<
  typeof GenerateSocialPostIdeasSchema
>;
