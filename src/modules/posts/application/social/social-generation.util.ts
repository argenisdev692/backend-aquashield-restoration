import type {
  SelectedIdeaInput,
  SocialIdeasInput,
  SocialPackageContext,
} from '../../domain/ports/social-post-generation.port';
import type { SocialPostPackage } from '../../domain/value-objects/social-post-package.vo';

/**
 * Stable cache keys, idempotent BullMQ job ids, and rotating Tavily research
 * queries for the 2-step social generator.
 *
 * Cache strategy lives in the Posts bounded context (not in the generic AI
 * client) — identical inputs hit cache and never re-call Gemini + Tavily within
 * the TTL, which is the dominant cost saver.
 */

export const SOCIAL_IDEAS_TTL_SECONDS = 3_600; // 1h — niche trends move slowly
export const SOCIAL_POST_TTL_SECONDS = 86_400; // 24h — full package is expensive

/** The 5 platforms the generator always produces variations for. */
export const SOCIAL_NETWORKS = [
  'blog',
  'linkedin',
  'twitter',
  'newsletter',
  'facebook',
] as const;

function djb2(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

export function buildIdeasCacheKey(input: SocialIdeasInput): string {
  const normalized = [
    input.niche,
    input.audience ?? '',
    input.goal ?? '',
    input.voice ?? '',
    [...input.platforms].sort().join(','),
  ]
    .join('|')
    .trim()
    .toLowerCase();
  return `social:ideas:${djb2(normalized)}`;
}

export function buildPackageCacheKey(
  idea: SelectedIdeaInput,
  context: SocialPackageContext,
): string {
  const normalized = [
    idea.id,
    idea.title,
    context.niche,
    context.audience ?? '',
    context.goal ?? '',
    context.voice ?? '',
    context.company ?? '',
  ]
    .join('|')
    .trim()
    .toLowerCase();
  return `social:package:${djb2(normalized)}`;
}

export function buildPackageJobId(
  idea: SelectedIdeaInput,
  context: SocialPackageContext,
): string {
  return `social-package-${buildPackageCacheKey(idea, context).split(':').pop()}`;
}

/**
 * Rotating Tavily queries per iteration so each regeneration gets fresh,
 * differently-angled grounding (mirrors the spec's `getTavilyQueries`).
 */
export function buildTavilyQueries(
  idea: SelectedIdeaInput,
  context: SocialPackageContext,
  iteration: number,
): string[] {
  const base = [
    `${idea.title} ${context.niche} 2026`,
    `${idea.keyTrend} statistics recent data`,
    `${context.niche} audience insights trends`,
  ];

  const byIteration: Record<number, string[]> = {
    1: base,
    2: [...base, `${context.niche} case study results ROI`],
    3: [...base, `${context.niche} expert opinion thought leadership`],
    4: [
      `${context.niche} authoritative sources citations`,
      `${idea.title} SEO keywords search volume`,
      `${idea.keyTrend} EEAT content examples`,
    ],
    5: [
      `${context.niche} top performing posts engagement`,
      `${idea.title} conversion rate benchmarks`,
      `${context.niche} human written content examples`,
    ],
  };

  return byIteration[iteration] ?? base;
}

/** Payload enqueued onto the SOCIAL_MEDIA_GENERATION queue. */
export interface SocialGenerationJobData {
  idea: SelectedIdeaInput;
  context: SocialPackageContext;
  networks: string[];
  cacheKey: string;
  userId: string;
}

/**
 * Job result returned by the processor: the persisted generation id (used by
 * the client to download the ZIP) plus the full package.
 *
 * NOTE: this crosses the BullMQ (Redis JSON) boundary, so on the receiving side
 * `pkg` is a plain object — consumers read properties only, never `pkg` methods.
 */
export interface SocialGenerationResult {
  id: string;
  pkg: SocialPostPackage;
}
