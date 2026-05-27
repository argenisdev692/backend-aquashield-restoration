import type { SocialNetwork } from '../entities/social-media-generation.entity';

export const POST_GENERATOR_PORT = Symbol('IPostGeneratorPort');

export interface GeneratePostsInput {
  topicTitle: string;
  topicDescription: string;
  activeNetworks: SocialNetwork[];
  language?: string;
}

export interface GeneratedPostForNetwork {
  body: string;
  hashtags: string[];
  emojis?: string; // instagram
  hook?: string; // tiktok
}

export type GeneratedPostsMap = Partial<
  Record<SocialNetwork, GeneratedPostForNetwork>
>;

export interface IPostGeneratorPort {
  generatePosts(input: GeneratePostsInput): Promise<GeneratedPostsMap>;
}
