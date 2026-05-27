export interface SocialMediaTopic {
  id: string; // client-generated or stable hash for the generate step
  title: string;
  description: string;
  whyViral: string;
  tags: string[];
  trendScore: number; // 0-100
}

export function createSocialMediaTopic(
  input: Omit<SocialMediaTopic, 'id'>,
): SocialMediaTopic {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    whyViral: input.whyViral,
    tags: input.tags,
    trendScore: Math.max(0, Math.min(100, input.trendScore)),
  };
}
