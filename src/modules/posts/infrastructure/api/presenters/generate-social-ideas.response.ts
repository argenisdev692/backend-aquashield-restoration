import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import type { SocialIdeaSet } from '../../../domain/value-objects/social-content-idea.vo';

export const GenerateSocialIdeasResponseSchema = z.object({
  niche_analysis: z.object({
    target_audience: z.string(),
    audience_demographics: z.string(),
    key_pain_points: z.array(z.string()),
    content_preferences: z.array(z.string()),
    trending_topics: z.array(z.string()),
    tavily_insights: z.array(z.string()),
  }),
  content_ideas: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      angle: z.string(),
      hook: z.string(),
      platform: z.string(),
      estimated_virality: z.number(),
      estimated_roi: z.number(),
      estimated_engagement: z.string(),
      difficulty: z.string(),
      eeat_potential: z.number(),
      why_it_works: z.string(),
      key_trend: z.string(),
      suggested_format: z.string(),
      content_type: z.string(),
    }),
  ),
});

export class GenerateSocialIdeasResponse extends createZodDto(
  GenerateSocialIdeasResponseSchema,
) {}

export function toSocialIdeasResponse(
  set: SocialIdeaSet,
): GenerateSocialIdeasResponse {
  return {
    niche_analysis: {
      target_audience: set.nicheAnalysis.targetAudience,
      audience_demographics: set.nicheAnalysis.audienceDemographics,
      key_pain_points: set.nicheAnalysis.keyPainPoints,
      content_preferences: set.nicheAnalysis.contentPreferences,
      trending_topics: set.nicheAnalysis.trendingTopics,
      tavily_insights: set.nicheAnalysis.tavilyInsights,
    },
    content_ideas: set.ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      angle: idea.angle,
      hook: idea.hook,
      platform: idea.platform,
      estimated_virality: idea.estimatedVirality,
      estimated_roi: idea.estimatedRoi,
      estimated_engagement: idea.estimatedEngagement,
      difficulty: idea.difficulty,
      eeat_potential: idea.eeatPotential,
      why_it_works: idea.whyItWorks,
      key_trend: idea.keyTrend,
      suggested_format: idea.suggestedFormat,
      content_type: idea.contentType,
    })),
  };
}
