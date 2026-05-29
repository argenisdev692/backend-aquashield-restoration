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

export interface ScoreEvaluation {
  human_writing_index: number;
  virality_score: number;
  engagement_score: number;
  roi_score: number;
  trend_alignment: number;
}

export interface RegenerationFeedback {
  iteration: number;
  previousScores: ScoreEvaluation;
  weaknesses: Array<{
    score: string;
    current: number;
    target: number;
    gap: number;
    explanation: string;
  }>;
}

export interface GeneratePostsWithFeedbackInput extends GeneratePostsInput {
  feedback?: RegenerationFeedback;
}

export interface GeneratedPostsWithScores extends GeneratedPostsMap {
  scores: ScoreEvaluation;
  ai_detection_risk: number;
}

export interface IPostGeneratorPort {
  generatePosts(input: GeneratePostsInput): Promise<GeneratedPostsMap>;
  generatePostsWithFeedback(
    input: GeneratePostsWithFeedbackInput,
  ): Promise<GeneratedPostsWithScores>;
}
