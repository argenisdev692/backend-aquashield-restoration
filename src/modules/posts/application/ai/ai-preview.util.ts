/**
 * Stable cache key and jobId generator for AI post preview generation.
 *
 * Used by both the CommandHandler (to check cache before enqueue)
 * and the BullMQ Processor (defensive cache check + store after generation).
 *
 * The goal is strong cost savings: identical (topic, niche, wordCount)
 * requests hit cache and never call Gemini + Tavily again within TTL.
 */
export function buildAiPreviewKey(
  topic: string,
  niche: string,
  wordCount: number,
): string {
  const normalized = `${topic.trim().toLowerCase()}|${niche.trim().toLowerCase()}|${wordCount}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `ai:preview:${Math.abs(hash)}`;
}

/**
 * Job ID for BullMQ — makes the job idempotent.
 * Same inputs → same jobId → BullMQ will not create duplicate jobs.
 */
export function buildAiPreviewJobId(
  topic: string,
  niche: string,
  wordCount: number,
): string {
  return `ai-preview-${buildAiPreviewKey(topic, niche, wordCount).split(':').pop()}`;
}
