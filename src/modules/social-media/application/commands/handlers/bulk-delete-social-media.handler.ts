import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { Transactional } from '@nestjs-cls/transactional';
import { BulkDeleteSocialMediaCommand } from '../bulk-delete-social-media.command';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { SOCIAL_MEDIA_CACHE_PATTERN } from '../../social-media-cache.constants';

@CommandHandler(BulkDeleteSocialMediaCommand)
@Injectable()
export class BulkDeleteSocialMediaHandler implements ICommandHandler<BulkDeleteSocialMediaCommand> {
  constructor(
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(BulkDeleteSocialMediaHandler.name);
  }

  @Transactional()
  async execute(
    command: BulkDeleteSocialMediaCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    this.logger.info('BulkDeleteSocialMediaHandler start', {
      traceId,
      count: ids.length,
    });

    const result = await this.repo.bulkDelete(ids);

    await this.audit.log(
      {
        action: 'social-media.bulk_deleted',
        actorId,
        resourceType: 'SOCIAL_MEDIA',
        metadata: { ids, count: result.count },
      },
      { strict: true },
    );

    this.eventEmitter.emit('social-media.bulk_deleted', { ids, actorId });

    await this.cache.delByPattern(SOCIAL_MEDIA_CACHE_PATTERN);

    this.logger.info('BulkDeleteSocialMediaHandler end', {
      traceId,
      deleted: result.count,
    });

    return result;
  }
}
