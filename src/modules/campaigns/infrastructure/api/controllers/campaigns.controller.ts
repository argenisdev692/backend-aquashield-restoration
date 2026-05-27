import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  StreamableFile,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiProduces,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';

import {
  RequestCampaignExportSchema,
  type RequestCampaignExportDto,
  RequestCampaignExportBody,
} from '../../../application/dtos/request-campaign-export.dto';

import {
  ExportCampaignExportsSchema,
  type ExportCampaignExportsInput,
} from '../../../application/dtos/export-campaign-exports.dto';

import type {
  CampaignExportStatusResponse,
  CampaignExportListItem,
} from '../../../application/dtos/campaign-export-response.dto';

import { RequestCampaignExportCommand } from '../../../application/commands/request-campaign-export.command';
import { GetCampaignExportStatusQuery } from '../../../application/queries/get-campaign-export-status.query';
import { ListMyCampaignExportsQuery } from '../../../application/queries/list-my-campaign-exports.query';
import { ExportCampaignExportsQuery } from '../../../application/queries/export-campaign-exports.query';

import { CampaignExportStatusResponse as CampaignExportStatusPresenter } from '../presenters/campaign-export-status.response';
import { CampaignExportListItemResponse } from '../presenters/campaign-export-list-item.response';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard, CaslGuard)
export class CampaignsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /campaigns/export
   * Accepts a new campaign video export request.
   * Returns 202 immediately; heavy work is performed asynchronously via BullMQ + WS notifications.
   */
  @Post('export')
  @HttpCode(202)
  @SkipCache()
  @Throttle({ campaignExport: { limit: 3, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Export, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Request campaign video export (TOFU/MOFU/BOFU/LOYALTY)',
    description:
      'Creates a persisted CampaignGeneration and enqueues background processing. ' +
      'Real-time progress is delivered via WebSocket on the campaigns namespace. ' +
      'Rate limited to 3 requests per minute per user. ' +
      'Only super-admin may invoke (expensive AI pipeline).',
  })
  @ApiBody({ type: RequestCampaignExportBody })
  @ApiResponse({ status: 202, description: 'Export request accepted' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires CAMPAIGN:export (super-admin only)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async requestExport(
    @Body(new ZodValidationPipe(RequestCampaignExportSchema))
    dto: RequestCampaignExportDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<{ generationId: string; status: 'pending' }> {
    const generationId = await this.commandBus.execute(
      new RequestCampaignExportCommand(dto, actorId),
    );
    return { generationId, status: 'pending' };
  }

  /**
   * GET /campaigns/export/:id
   * Returns full status + per-stage ZIP download links (when ready).
   */
  @Get('export/:id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CAMPAIGN' })
  @ApiOperation({ summary: 'Get status and download links for a campaign export' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CampaignExportStatusPresenter })
  @ApiNotFoundResponse()
  @ApiResponse({ status: 403, description: 'Forbidden — requires CAMPAIGN:read (super-admin only)' })
  async getExportStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<CampaignExportStatusResponse> {
    return this.queryBus.execute(
      new GetCampaignExportStatusQuery(id, actorId),
    );
  }

  /**
   * GET /campaigns/exports
   * Lists the authenticated user's recent campaign exports (lightweight list view).
   */
  @Get('exports')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CAMPAIGN' })
  @ApiOperation({ summary: 'List my campaign exports' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: [CampaignExportListItemResponse] })
  @ApiResponse({ status: 403, description: 'Forbidden — requires CAMPAIGN:read (super-admin only)' })
  async listExports(
    @CurrentUser('sub') actorId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<CampaignExportListItem[]> {
    const cappedLimit = Math.min(Math.max(1, Number(limit)), 100);
    const cappedOffset = Math.max(0, Number(offset));
    return this.queryBus.execute(
      new ListMyCampaignExportsQuery(actorId, {
        limit: cappedLimit,
        offset: cappedOffset,
      }),
    );
  }

  /**
   * POST /campaigns/exports/export
   * Exports the authenticated user's campaign generation history (list) as CSV / XLSX / PDF.
   * This is a privileged operation (audited + gated by CAMPAIGN:export).
   */
  @Post('exports/export')
  @SkipCache()
  @Throttle({ campaignExport: { limit: 5, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Export, subject: 'CAMPAIGN' })
  @ApiOperation({ summary: 'Export campaign generation history as file' })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiOkResponse({ description: 'Binary file', content: { 'application/octet-stream': {} } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires CAMPAIGN:export (super-admin only)' })
  async exportList(
    @Body(new ZodValidationPipe(ExportCampaignExportsSchema))
    dto: ExportCampaignExportsInput,
    @CurrentUser('sub') actorId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.queryBus.execute(
      new ExportCampaignExportsQuery(dto, actorId),
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }
}
