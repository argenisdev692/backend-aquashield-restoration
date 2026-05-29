import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ListSocialMediaQuery } from '../list-social-media.query';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type {
  ISocialMediaRepository,
  PaginatedSocialMediaGenerations,
} from '../../../domain/ports/social-media-repository.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';

@QueryHandler(ListSocialMediaQuery)
@Injectable()
export class ListSocialMediaHandler implements IQueryHandler<ListSocialMediaQuery> {
  constructor(
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ListSocialMediaHandler.name);
  }

  async execute(
    query: ListSocialMediaQuery,
  ): Promise<PaginatedSocialMediaGenerations> {
    const traceId = this.cls.get<string>('traceId');
    const { dto, actorId } = query;

    this.logger.info('ListSocialMediaHandler start', { traceId, actorId });

    const dateRange = resolveDateRange({
      start_date: dto.start_date,
      end_date: dto.end_date,
    });

    const result = await this.repo.findAll(
      {
        userId: actorId, // scope to current user for privacy
        niche: dto.niche,
        language: dto.language,
        network: dto.network,
        dateRange,
      },
      dto.page,
      dto.limit,
    );

    this.logger.info('ListSocialMediaHandler end', {
      traceId,
      total: result.total,
    });

    return result;
  }
}
