import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePostSchema = z.object({
  // All text fields below are server-sanitized on every create/update (OWASP).
  // postContent supports safe rich Markdown/HTML. All other fields are stripped of HTML.
  postTitle: z.string().min(1).max(255).describe(
    'Post title. HTML is stripped server-side (plain text only).',
  ),
  postTitleSlug: z.string().max(255).optional().describe(
    'URL slug. If omitted, generated from title. HTML is stripped server-side.',
  ),
  postContent: z.string().min(1).describe(
    'Main article body. Accepts Markdown (recommended) or safe HTML. Server will sanitize on every create/update using a strict OWASP allowlist that supports: headings, paragraphs, lists, bold/italic/underline/strike, links, blockquotes, code/pre, images, and basic tables. Dangerous tags/attributes/scripts are always stripped. Client-provided values override AI-generated ones.',
  ),
  postExcerpt: z.string().max(500).nullable().optional().describe(
    'Short excerpt / description. HTML is stripped server-side.',
  ),
  postCoverImage: z.string().max(2048).nullable().optional(),
  metaTitle: z.string().max(255).nullable().optional().describe(
    'SEO meta title. HTML is stripped server-side.',
  ),
  metaDescription: z.string().max(500).nullable().optional().describe(
    'SEO meta description. HTML is stripped server-side.',
  ),
  metaKeywords: z.string().max(255).nullable().optional().describe(
    'Comma-separated keywords. HTML is stripped server-side.',
  ),
  categoryId: z.string().uuid().nullable().optional(),
  postStatus: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  scheduledAt: z.string().datetime().nullable().optional(),

  // AI generation trigger (option A) + parameters for the generation call
  generateWithAi: z
    .boolean()
    .optional()
    .describe(
      'When true, the backend will automatically generate the full post content (Markdown), SEO fields, and optionally a hero image using Google Gemini + Tavily research (E-E-A-T). Generation + image upload to R2 happens BEFORE the database transaction. Client-provided values for content/SEO/image take precedence and override generated ones. Requires valid TAVILY_API_KEY and GEMINI_API_KEY.',
    ),
  aiNiche: z
    .string()
    .min(2)
    .max(100)
    .optional()
    .describe(
      'Industry/vertical used to guide the AI writer (tone, examples, E-E-A-T grounding). Only used when generateWithAi=true. Example: "Desarrollo Web", "Fintech", "Salud". Defaults to "industry insights" if omitted.',
    ),
  aiWordCount: z
    .coerce
    .number()
    .int()
    .min(300)
    .max(5000)
    .optional()
    .describe(
      'Target word count for the AI-generated article body (300-5000). Only used when generateWithAi=true. Defaults to 1200 if omitted.',
    ),
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
    if (data.postStatus === 'scheduled' && data.scheduledAt && new Date(data.scheduledAt).getTime() <= Date.now()) {
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
      if (new Date(data.scheduledAt).getTime() < minDate.getTime()) {
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
