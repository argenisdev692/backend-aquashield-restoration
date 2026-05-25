import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetSocialMediaByIdQuery } from '../get-social-media-by-id.query';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../../domain/ports/social-media-repository.port';
import type { SocialMediaGeneration } from '../../../domain/entities/social-media-generation.entity';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@QueryHandler(GetSocialMediaByIdQuery)
@Injectable()
export class GetSocialMediaByIdHandler implements IQueryHandler<GetSocialMediaByIdQuery> {
  constructor(
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetSocialMediaByIdHandler.name);
  }

  async execute(query: GetSocialMediaByIdQuery): Promise<SocialMediaGeneration> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetSocialMediaByIdHandler start', { traceId, id: query.id });

    const record = await this.repo.findById(query.id);
    if (!record) {
      throw new NotFoundException('Social media generation not found');
    }

    this.logger.info('GetSocialMediaByIdHandler end', { traceId });
    return record;
  }
}
