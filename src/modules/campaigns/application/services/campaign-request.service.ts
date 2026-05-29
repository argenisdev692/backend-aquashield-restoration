import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../domain/ports/campaign-generation.repository.port';
import { COMPANY_DATA_LOOKUP_PORT } from '../../domain/ports/outbound/company-data-lookup.port';
import type { ICompanyDataLookupPort } from '../../domain/ports/outbound/company-data-lookup.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CampaignGeneration } from '../../domain/entities/campaign-generation.aggregate';
import { FunnelStageVO, type FunnelStage } from '../../domain/value-objects/funnel-stage.vo';
import { VideoFormatVO, type VideoFormat } from '../../domain/value-objects/video-format.vo';
import { CampaignExportRequestedEvent } from '../../domain/events/campaign-export-requested.event';
import { LoggerService } from '../../../../logger/logger.service';

/**
 * Fields shared by both campaign-generation request DTOs
 * (`POST /campaigns/export` and `POST /campaigns/generate-campaign`).
 */
export interface CampaignGenerationRequestInput {
  companyDataId: string;
  niche: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  phone: string;
  website?: string;
  stages: FunnelStage[];
  format: VideoFormat;
  durationSeconds: 15 | 20;
  language: string;
  generateImages: boolean;
  aiObservations?: string;
}

export interface RequestCampaignGenerationParams {
  input: CampaignGenerationRequestInput;
  actorId: string;
  /** Audit action, e.g. `campaigns.export_requested` or `campaigns.generate_campaign`. */
  auditAction: string;
  /** Selected topic id from Step 1, if the caller is the 2-step flow. */
  topicId?: string;
  /** Extra metadata to merge into the audit row (e.g. aiProvider). */
  auditMetadata?: Record<string, unknown>;
}

/**
 * Shared write path for accepting a campaign-generation request.
 *
 * Both command handlers (`/export` and `/generate-campaign`) delegate here so
 * the create → audit → cache-invalidate → emit sequence lives in exactly one
 * place (DRY). The caller's `@Transactional()` boundary wraps this call.
 */
@Injectable()
export class CampaignRequestService {
  /** Mirrors the CacheTtlInterceptor key scheme so invalidation actually hits cached GETs. */
  private static readonly CACHE_PATTERN = 'http:*:/campaigns*';

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
    this.logger.setContext(CampaignRequestService.name);
  }

  async requestGeneration(
    params: RequestCampaignGenerationParams,
  ): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    const { input, actorId, auditAction, topicId, auditMetadata } = params;

    this.logger.info('CampaignRequestService.requestGeneration start', {
      traceId,
      actorId,
      auditAction,
      companyDataId: input.companyDataId,
      stages: input.stages,
      format: input.format,
      topicId,
    });

    // 1. Resolve real company name via ACL (cross-context, ownership enforced)
    const companyName = await this.companyDataLookup.getCompanyNameByIdForUser(
      input.companyDataId,
      actorId,
    );
    if (!companyName) {
      throw new NotFoundException('Company profile not found or access denied');
    }

    // 2. Map to domain VOs (defensive — rejects unknown stage/format)
    const stages = input.stages.map((s) => FunnelStageVO.fromString(s).value);
    const format = VideoFormatVO.fromString(input.format).value;

    // 3. Create rich aggregate with immutable company-name snapshot
    const aggregate = CampaignGeneration.create({
      userId: actorId,
      companyDataId: input.companyDataId,
      companyNameSnapshot: companyName,
      niche: input.niche,
      location: input.location,
      phone: input.phone,
      website: input.website || undefined,
      stages,
      format,
      durationSeconds: input.durationSeconds,
      language: input.language ?? 'es',
      generateImages: input.generateImages ?? false,
      aiObservations: input.aiObservations ?? null,
    });

    // 4. Persist (also creates the stage export placeholder rows)
    const generatedId = await this.campaignRepo.save(aggregate);
    const generationId = aggregate.id ?? generatedId!;

    // 5. Audit (mandatory, strict — failure aborts the surrounding tx)
    await this.audit.log(
      {
        action: auditAction,
        actorId,
        resourceId: generationId,
        metadata: {
          companyDataId: input.companyDataId,
          companyNameSnapshot: companyName,
          niche: input.niche,
          stages: input.stages,
          format: input.format,
          generateImages: input.generateImages,
          topicId: topicId ?? null,
          ...auditMetadata,
        },
      },
      { strict: true },
    );

    // 6. Invalidate cached campaign GETs (after DB writes, outside the tx work)
    await this.cache.delByPattern(CampaignRequestService.CACHE_PATTERN);

    // 7. Publish domain event → listener enqueues the BullMQ job
    this.eventEmitter.emit(
      'campaign.export.requested',
      new CampaignExportRequestedEvent(generationId, actorId, {
        companyDataId: input.companyDataId,
        companyNameSnapshot: companyName,
        niche: input.niche,
        location: input.location,
        city: input.city,
        state: input.state,
        country: input.country,
        phone: input.phone,
        website: input.website,
        stages: input.stages,
        format: input.format,
        durationSeconds: input.durationSeconds,
        language: input.language ?? 'es',
        generateImages: input.generateImages ?? false,
        aiObservations: input.aiObservations,
        topicId,
      }),
    );

    this.logger.info('CampaignRequestService.requestGeneration end', {
      traceId,
      generationId,
      actorId,
    });

    return generationId;
  }
}
