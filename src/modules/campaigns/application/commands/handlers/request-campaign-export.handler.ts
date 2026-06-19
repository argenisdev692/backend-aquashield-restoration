import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestCampaignExportCommand } from '../request-campaign-export.command';
import { CampaignRequestService } from '../../services/campaign-request.service';

/**
 * Accepts a campaign video export request (`POST /campaigns/export`).
 * Shares the write path with {@link GenerateCampaignHandler} via
 * {@link CampaignRequestService} — no duplicated create/audit/cache/emit logic.
 */
@CommandHandler(RequestCampaignExportCommand)
@Injectable()
export class RequestCampaignExportHandler implements ICommandHandler<RequestCampaignExportCommand> {
  constructor(private readonly campaignRequest: CampaignRequestService) {}

  @Transactional()
  async execute(command: RequestCampaignExportCommand): Promise<string> {
    const { dto, actorId } = command;
    return this.campaignRequest.requestGeneration({
      input: dto,
      actorId,
      auditAction: 'campaigns.export_requested',
    });
  }
}
