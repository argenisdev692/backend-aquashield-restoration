import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { DeleteSocialMediaCommand } from '../delete-social-media.command';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { SOCIAL_MEDIA_CACHE_PATTERN } from '../../social-media-cache.constants';

@CommandHandler(DeleteSocialMediaCommand)
@Injectable()
export class DeleteSocialMediaHandler implements ICommandHandler<DeleteSocialMediaCommand> {
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
    this.logger.setContext(DeleteSocialMediaHandler.name);
  }

  async execute(command: DeleteSocialMediaCommand): Promise<void> {
    const { id, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    this.logger.info('DeleteSocialMediaHandler start', { traceId, id });

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Social media generation not found');
    }

    await this.repo.delete(id);

    await this.audit.log(
      {
        action: 'social-media.deleted',
        actorId,
        resourceId: id,
        resourceType: 'SOCIAL_MEDIA',
      },
      { strict: true },
    );

    this.eventEmitter.emit('social-media.deleted', { id, actorId });

    await this.cache.delByPattern(SOCIAL_MEDIA_CACHE_PATTERN);

    this.logger.info('DeleteSocialMediaHandler end', { traceId });
  }
}
