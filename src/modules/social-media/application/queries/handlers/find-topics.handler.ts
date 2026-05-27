import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { FindTopicsQuery } from '../find-topics.query';
import { TOPIC_FINDER_PORT } from '../../../domain/ports/topic-finder.port';
import type { ITopicFinderPort } from '../../../domain/ports/topic-finder.port';
import type { SocialMediaTopic } from '../../../domain/entities/social-media-topic.entity';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@QueryHandler(FindTopicsQuery)
@Injectable()
export class FindTopicsHandler implements IQueryHandler<FindTopicsQuery> {
  constructor(
    @Inject(TOPIC_FINDER_PORT)
    private readonly topicFinder: ITopicFinderPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(FindTopicsHandler.name);
  }

  async execute(query: FindTopicsQuery): Promise<SocialMediaTopic[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('FindTopicsHandler start', {
      traceId,
      niche: query.dto.niche,
    });

    const topics = await this.topicFinder.findTrendingTopics({
      niche: query.dto.niche,
      language: query.dto.language,
      maxTopics: query.dto.maxTopics,
    });

    this.logger.info('FindTopicsHandler end', {
      traceId,
      count: topics.length,
    });
    return topics;
  }
}
