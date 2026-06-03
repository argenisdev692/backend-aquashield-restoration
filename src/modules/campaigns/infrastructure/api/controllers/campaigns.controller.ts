import {
  Controller,
  Post,
  Get,
  Delete,
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
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';

import {
  RequestCampaignExportSchema,
  type RequestCampaignExportDto,
  RequestCampaignExportBody,
} from '../../../application/dtos/request-campaign-export.dto';

import {
  ExportCampaignExportsSchema,
  type ExportCampaignExportsInput,
} from '../../../application/dtos/export-campaign-exports.dto';

import {
  BulkDeleteCampaignsSchema,
  type BulkDeleteCampaignsDto,
  BulkDeleteCampaignsBody,
  type BulkDeleteCampaignsResponse,
} from '../../../application/dtos/bulk-delete-campaigns.dto';

import {
  ListCampaignsSchema,
  type ListCampaignsDto,
} from '../../../application/dtos/list-campaigns.dto';

import {
  GenerateTopicsSchema,
  type GenerateTopicsDto,
  GenerateTopicsBody,
  type GenerateTopicsResponse,
} from '../../../application/dtos/generate-topics.dto';

import {
  GenerateCampaignSchema,
  type GenerateCampaignDto,
  GenerateCampaignBody,
  type GenerateCampaignResponse,
} from '../../../application/dtos/generate-campaign.dto';

import type {
  CampaignExportStatusResponse,
  CampaignExportListItem,
} from '../../../application/dtos/campaign-export-response.dto';

import { RequestCampaignExportCommand } from '../../../application/commands/request-campaign-export.command';
import { DeleteCampaignCommand } from '../../../application/commands/delete-campaign.command';
import { BulkDeleteCampaignsCommand } from '../../../application/commands/bulk-delete-campaigns.command';
import { GenerateTopicsCommand } from '../../../application/commands/generate-topics.command';
import { GenerateCampaignCommand } from '../../../application/commands/generate-campaign.command';
import { GetCampaignExportStatusQuery } from '../../../application/queries/get-campaign-export-status.query';
import { ListMyCampaignExportsQuery } from '../../../application/queries/list-my-campaign-exports.query';
import { ExportCampaignExportsQuery } from '../../../application/queries/export-campaign-exports.query';

import { CampaignExportStatusResponse as CampaignExportStatusPresenter } from '../presenters/campaign-export-status.response';
import { CampaignExportListItemResponse } from '../presenters/campaign-export-list-item.response';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard, CaslGuard)
export class CampaignsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /campaigns/generate-topics
   * Step 1 of 2-step campaign generation: Generate 10 campaign topics.
   */
  @Post('generate-topics')
  @HttpCode(200)
  @SkipCache()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Export, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Generate campaign topics (Step 1 of 2)',
    description:
      'Generates 10 campaign topics based on niche, location, and AI observations. ' +
      'Returns topics with scores for selection in Step 2.',
  })
  @ApiBody({ type: GenerateTopicsBody })
  @ApiResponse({ status: 200, description: 'Topics generated' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:export (super-admin only)',
  })
  async generateTopics(
    @Body(new ZodValidationPipe(GenerateTopicsSchema))
    dto: GenerateTopicsDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<GenerateTopicsResponse> {
    return this.commandBus.execute(new GenerateTopicsCommand(dto, actorId));
  }

  /**
   * POST /campaigns/generate-campaign
   * Step 2 of 2-step campaign generation: Generate full campaign from selected topic.
   */
  @Post('generate-campaign')
  @HttpCode(202)
  @SkipCache()
  @Throttle({ campaignExport: { limit: 3, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Export, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Generate campaign from topic (Step 2 of 2)',
    description:
      'Creates a persisted CampaignGeneration and enqueues background processing. ' +
      'Real-time progress is delivered via WebSocket on the campaigns namespace. ' +
      'Rate limited to 3 requests per minute per user. ' +
      'Only super-admin may invoke (expensive AI pipeline).',
  })
  @ApiBody({ type: GenerateCampaignBody })
  @ApiResponse({ status: 202, description: 'Campaign generation started' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:export (super-admin only)',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async generateCampaign(
    @Body(new ZodValidationPipe(GenerateCampaignSchema))
    dto: GenerateCampaignDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<GenerateCampaignResponse> {
    const result = await this.commandBus.execute(
      new GenerateCampaignCommand(dto, actorId),
    );
    return result;
  }

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
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:export (super-admin only)',
  })
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
  @ApiOperation({
    summary: 'Get status and download links for a campaign export',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CampaignExportStatusPresenter })
  @ApiNotFoundResponse()
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:read (super-admin only)',
  })
  async getExportStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<CampaignExportStatusResponse> {
    return this.queryBus.execute(new GetCampaignExportStatusQuery(id, actorId));
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
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:read (super-admin only)',
  })
  async listExports(
    @CurrentUser('sub') actorId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<{ data: CampaignExportListItem[]; total: number }> {
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
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({
    description: 'Binary file',
    content: { 'application/octet-stream': {} },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:export (super-admin only)',
  })
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

  /**
   * GET /campaigns
   * Lists campaign generations with pagination and filters.
   */
  @Get()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CAMPAIGN' })
  @ApiOperation({ summary: 'List campaign generations' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'processing', 'completed', 'failed', 'partial'] })
  @ApiQuery({ name: 'withTrashed', required: false, type: Boolean })
  @ApiQuery({ name: 'onlyTrashed', required: false, type: Boolean })
  @ApiQuery({ name: 'start_date', required: false, type: String, description: 'Filter by creation date (ISO 8601)' })
  @ApiQuery({ name: 'end_date', required: false, type: String, description: 'Filter by creation date (ISO 8601)' })
  @ApiOkResponse({ type: [CampaignExportListItemResponse] })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:read (super-admin only)',
  })
  async listCampaigns(
    @CurrentUser('sub') actorId: string,
    @Query(new ZodValidationPipe(ListCampaignsSchema)) query: ListCampaignsDto,
  ): Promise<{ data: CampaignExportListItem[]; total: number }> {
    const dateRange = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });

    return this.queryBus.execute(
      new ListMyCampaignExportsQuery(actorId, {
        limit: query.limit,
        offset: query.offset,
        dateRange,
      }),
    );
  }

  /**
   * GET /campaigns/:id
   * Returns full status + per-stage ZIP download links for a campaign generation.
   */
  @Get(':id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Get campaign generation details',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CampaignExportStatusPresenter })
  @ApiNotFoundResponse()
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:read (super-admin only)',
  })
  async getCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<CampaignExportStatusResponse> {
    return this.queryBus.execute(new GetCampaignExportStatusQuery(id, actorId));
  }

  /**
   * DELETE /campaigns/:id
   * Hard deletes a campaign generation.
   */
  @Delete(':id')
  @HttpCode(200)
  @SkipCache()
  @CheckAbilities({ action: Action.Delete, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Delete campaign generation (hard delete)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campaign deleted' })
  @ApiNotFoundResponse()
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:delete (super-admin only)',
  })
  async deleteCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteCampaignCommand(id, actorId));
  }

  /**
   * POST /campaigns/bulk-delete
   * Bulk hard deletes campaign generations.
   */
  @Post('bulk-delete')
  @HttpCode(200)
  @SkipCache()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Delete, subject: 'CAMPAIGN' })
  @ApiOperation({
    summary: 'Bulk delete campaign generations (hard delete)',
  })
  @ApiBody({ type: BulkDeleteCampaignsBody })
  @ApiResponse({ status: 200, description: 'Campaigns deleted' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires CAMPAIGN:delete (super-admin only)',
  })
  async bulkDeleteCampaigns(
    @Body(new ZodValidationPipe(BulkDeleteCampaignsSchema))
    dto: BulkDeleteCampaignsDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<BulkDeleteCampaignsResponse> {
    const result = await this.commandBus.execute(
      new BulkDeleteCampaignsCommand(dto, actorId),
    );
    return { count: result.count, message: `${result.count} campaigns deleted` };
  }
}
