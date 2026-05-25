import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestCampaignExportCommand } from '../request-campaign-export.command';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import { COMPANY_DATA_LOOKUP_PORT } from '../../../domain/ports/outbound/company-data-lookup.port';
import type { ICompanyDataLookupPort } from '../../../domain/ports/outbound/company-data-lookup.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { CampaignGeneration } from '../../../domain/entities/campaign-generation.aggregate';
import { FunnelStageVO } from '../../../domain/value-objects/funnel-stage.vo';
import { VideoFormatVO } from '../../../domain/value-objects/video-format.vo';
import { CampaignExportRequestedEvent } from '../../../domain/events/campaign-export-requested.event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@CommandHandler(RequestCampaignExportCommand)
@Injectable()
export class RequestCampaignExportHandler
  implements ICommandHandler<RequestCampaignExportCommand>
{
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(COMPANY_DATA_LOOKUP_PORT)
    private readonly companyDataLookup: ICompanyDataLookupPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RequestCampaignExportHandler.name);
  }

  @Transactional()
  async execute(command: RequestCampaignExportCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    const { dto, actorId } = command;

    this.logger.info('RequestCampaignExportHandler start', {
      traceId,
      actorId,
      companyDataId: dto.companyDataId,
      stages: dto.stages,
      format: dto.format,
    });

    // 1. Resolve real company name via ACL (cross-context, ownership enforced)
    const companyName = await this.companyDataLookup.getCompanyNameByIdForUser(
      dto.companyDataId,
      actorId,
    );

    if (!companyName) {
      throw new NotFoundException('Company profile not found or access denied');
    }

    // 2. Map DTO → Domain VOs (defensive)
    const stages = dto.stages.map((s) => FunnelStageVO.fromString(s).value);
    const format = VideoFormatVO.fromString(dto.format).value;

    // 3. Create rich aggregate with immutable company name snapshot
    const aggregate = CampaignGeneration.create({
      userId: actorId,
      companyDataId: dto.companyDataId,
      companyNameSnapshot: companyName,
      niche: dto.niche,
      location: dto.location,
      phone: dto.phone,
      website: dto.website || undefined,
      stages,
      format,
      durationSeconds: dto.durationSeconds,
      language: dto.language ?? 'es',
      generateImages: dto.generateImages ?? false,
      aiObservations: dto.aiObservations ?? null,
    });

    // 4. Persist (this also creates the stage export placeholder rows)
    const generatedId = await this.campaignRepo.save(aggregate);
    const generationId = aggregate.id ?? generatedId!;

    // 5. Audit the business action (mandatory for all state mutations)
    await this.audit.log(
      {
        action: 'campaigns.export_requested',
        actorId,
        resourceId: generationId,
        metadata: {
          companyDataId: dto.companyDataId,
          companyNameSnapshot: companyName,
          niche: dto.niche,
          stages: dto.stages,
          format: dto.format,
          generateImages: dto.generateImages,
        },
      },
      { strict: true },
    );

    // 6. Invalidate relevant caches (outside tx conceptually, runs after DB writes)
    await this.cache.delByPattern('campaigns:exports:*');

    // 7. Publish domain event (after successful persistence + audit)
    this.eventEmitter.emit(
      'campaign.export.requested',
      new CampaignExportRequestedEvent(generationId, actorId, {
        companyDataId: dto.companyDataId,
        companyNameSnapshot: companyName,
        niche: dto.niche,
        location: dto.location,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        phone: dto.phone,
        website: dto.website,
        stages: dto.stages,
        format: dto.format,
        durationSeconds: dto.durationSeconds,
        language: dto.language ?? 'es',
        generateImages: dto.generateImages ?? false,
        aiObservations: dto.aiObservations,
      }),
    );

    this.logger.info('RequestCampaignExportHandler end', {
      traceId,
      generationId,
      actorId,
    });

    return generationId;
  }
}
