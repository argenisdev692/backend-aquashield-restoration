import type { SocialMediaTopic } from '../entities/social-media-topic.entity';

export const TOPIC_FINDER_PORT = Symbol('ITopicFinderPort');

export interface TopicFinderFilters {
  niche: string;
  language?: string;
  maxTopics?: number;
}

export interface ITopicFinderPort {
  findTrendingTopics(filters: TopicFinderFilters): Promise<SocialMediaTopic[]>;
}
