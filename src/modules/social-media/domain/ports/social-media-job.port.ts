import type { SocialNetwork } from '../entities/social-media-generation.entity';

export const SOCIAL_MEDIA_JOB_PORT = Symbol('ISocialMediaJobPort');

export interface EnqueueGeneratePostInput {
  actorId: string;
  topicTitle: string;
  topicDescription: string;
  activeNetworks: SocialNetwork[];
  language?: string;
}

export interface EnqueueGeneratePostResult {
  jobId: string;
  status: 'queued';
}

export interface ISocialMediaJobPort {
  enqueueGeneratePost(
    input: EnqueueGeneratePostInput,
  ): Promise<EnqueueGeneratePostResult>;
}
