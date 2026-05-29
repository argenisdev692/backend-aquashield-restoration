import { z } from 'zod';

/**
 * Accepts the raw idea object emitted by Step 1 (`/social/generate-ideas`),
 * which uses `suggested_format` (not `format`) and carries extra scoring
 * fields. We keep the schema tolerant (unknown keys are stripped) and accept
 * either `format` or `suggested_format`; the handler normalizes to the port
 * shape. This is the contract the frontend (`post-creator-v2.jsx`) actually
 * sends, so requiring a bare `format` would 400 every real request.
 */
export const SelectedIdeaSchema = z
  .object({
    id: z.number(),
    title: z.string().min(1),
    angle: z.string().default(''),
    hook: z.string().default(''),
    platform: z.string().default('multi'),
    format: z.string().optional(),
    suggested_format: z.string().optional(),
    key_trend: z.string().default(''),
  })
  .transform((idea) => ({
    id: idea.id,
    title: idea.title,
    angle: idea.angle,
    hook: idea.hook,
    platform: idea.platform,
    format: idea.format ?? idea.suggested_format ?? 'post',
    keyTrend: idea.key_trend,
  }));

export const GenerateSocialPostSchema = z.object({
  selectedIdea: SelectedIdeaSchema,
  audience: z.string().optional(),
  goal: z.string().optional(),
  voice: z.string().optional(),
  company: z.string().optional(),
  niche: z.string().min(1),
  provider: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
});

export type GenerateSocialPostDto = z.infer<typeof GenerateSocialPostSchema>;
