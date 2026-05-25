export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';

export interface GeneratedPostImage {
  /** Public URL after R2 upload (CDN) */
  url?: string;
  /** Internal R2 storage key (for deletion / management) */
  r2Key?: string;
  mimeType?: string;
}

export interface GeneratedPost {
  body: string;
  hashtags: string[];
  emojis?: string; // instagram only
  hook?: string;   // tiktok only
  /** Optional AI-generated image for this network post (Google Gen AI / Imagen) */
  image?: GeneratedPostImage;
}

export interface SocialMediaGeneration {
  id: string;
  userId: string;
  niche: string;
  topicTitle: string;
  topicDescription?: string | null;
  language?: string | null;
  networks: Partial<Record<SocialNetwork, boolean>>;
  generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>>;
  r2Key?: string | null;
  createdAt: Date;
}

export interface CreateSocialMediaGenerationInput {
  userId: string;
  niche: string;
  topicTitle: string;
  topicDescription?: string;
  language?: string;
  networks: Partial<Record<SocialNetwork, boolean>>;
  generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>>;
  r2Key?: string;
}

export function createSocialMediaGeneration(
  input: CreateSocialMediaGenerationInput,
): SocialMediaGeneration {
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    niche: input.niche,
    topicTitle: input.topicTitle,
    topicDescription: input.topicDescription ?? null,
    language: input.language ?? null,
    networks: { ...input.networks },
    generatedPosts: { ...input.generatedPosts },
    r2Key: input.r2Key ?? null,
    createdAt: new Date(),
  };
}
