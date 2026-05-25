import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';
import { GeneratePostCommand } from '../generate-post.command';
import { LoggerService } from '../../../../../logger/logger.service';
import type { SocialNetwork } from '../../../domain/entities/social-media-generation.entity';
import {
  SOCIAL_MEDIA_JOB_PORT,
  type ISocialMediaJobPort,
  type EnqueueGeneratePostResult,
} from '../../../domain/ports/social-media-job.port';

@CommandHandler(GeneratePostCommand)
@Injectable()
export class GeneratePostHandler implements ICommandHandler<GeneratePostCommand> {
  constructor(
    @Inject(SOCIAL_MEDIA_JOB_PORT)
    private readonly jobPort: ISocialMediaJobPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GeneratePostHandler.name);
  }

  async execute(command: GeneratePostCommand): Promise<EnqueueGeneratePostResult> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    const activeNetworks = (Object.keys(dto.networks) as SocialNetwork[]).filter(
      (n) => dto.networks[n],
    );

    this.logger.info('GeneratePostHandler start', {
      traceId,
      actorId,
      networks: activeNetworks,
    });

    const result = await this.jobPort.enqueueGeneratePost({
      actorId,
      topicTitle: dto.topic.title,
      topicDescription: dto.topic.description,
      activeNetworks,
      language: dto.language,
    });

    this.logger.info('GeneratePostHandler job enqueued', {
      traceId,
      jobId: result.jobId,
    });

    return result;
  }
}
