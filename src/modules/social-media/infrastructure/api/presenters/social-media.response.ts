import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SocialMediaTopicResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  whyViral: z.string(),
  tags: z.array(z.string()),
  trendScore: z.number().int().min(0).max(100),
});

export class SocialMediaTopicResponse extends createZodDto(SocialMediaTopicResponseSchema) {}

export const GeneratedPostImageSchema = z.object({
  url: z.string().url().optional(),
  r2Key: z.string().optional(),
  mimeType: z.string().optional(),
});

export const GeneratedPostSchema = z.object({
  body: z.string(),
  hashtags: z.array(z.string()),
  emojis: z.string().optional(),
  hook: z.string().optional(),
  /** Optional AI-generated image (produced with Google Gen AI / Imagen) */
  image: GeneratedPostImageSchema.optional(),
});

export const AiDetectionScoreSchema = z.object({
  aiGenerated: z.number().min(0).max(100),
  aiParaphrased: z.number().min(0).max(100),
  humanWritten: z.number().min(0).max(100),
  showsAiSigns: z.number().min(0).max(100),
});

export const SocialMediaGenerationResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  niche: z.string(),
  topicTitle: z.string(),
  topicDescription: z.string().nullable(),
  language: z.string().nullable(),
  networks: z.record(z.string(), z.boolean()),
  generatedPosts: z.record(z.string(), GeneratedPostSchema),
  r2Key: z.string().nullable().optional(),
  viralityScore: z.number().nullable().optional(),
  roiScore: z.number().nullable().optional(),
  aiDetectionScore: AiDetectionScoreSchema.nullable().optional(),
  analysisReportKey: z.string().nullable().optional(),
  analysisReportUrl: z.string().url().nullable().optional(),
  createdAt: z.string().datetime(),
});

export class SocialMediaGenerationResponse extends createZodDto(
  SocialMediaGenerationResponseSchema,
) {}

export const PaginatedSocialMediaResponseSchema = z.object({
  data: z.array(SocialMediaGenerationResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export class PaginatedSocialMediaResponse extends createZodDto(
  PaginatedSocialMediaResponseSchema,
) {}
