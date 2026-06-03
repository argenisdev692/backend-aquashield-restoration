import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { GeneratePostCommand } from '../../../application/commands/generate-post.command';
import { DeleteSocialMediaCommand } from '../../../application/commands/delete-social-media.command';
import { BulkDeleteSocialMediaCommand } from '../../../application/commands/bulk-delete-social-media.command';
import { FindTopicsQuery } from '../../../application/queries/find-topics.query';
import { GetSocialMediaByIdQuery } from '../../../application/queries/get-social-media-by-id.query';
import { ListSocialMediaQuery } from '../../../application/queries/list-social-media.query';
import {
  ExportSocialMediaCommand,
  type ExportSocialMediaResult,
} from '../../../application/commands/export-social-media.command';
import {
  DownloadZipCommand,
  type DownloadZipResult,
} from '../../../application/commands/download-zip.command';
import {
  FindTopicsDto,
  FindTopicsSchema,
} from '../../../application/dtos/find-topics.dto';
import {
  GeneratePostDto,
  GeneratePostSchema,
} from '../../../application/dtos/generate-post.dto';
import {
  GeneratePostJobResultDto,
  GeneratePostJobResultSchema,
} from '../../../application/dtos/generate-post-result.dto';
import {
  ListSocialMediaDto,
  ListSocialMediaSchema,
} from '../../../application/dtos/list-social-media.dto';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';
import {
  ExportSocialMediaDto,
  ExportSocialMediaSchema,
} from '../../../application/dtos/export-social-media.dto';
import {
  SocialMediaTopicResponse,
  SocialMediaGenerationResponse,
  PaginatedSocialMediaResponse,
} from '../presenters/social-media.response';
import type { SocialMediaTopic } from '../../../domain/entities/social-media-topic.entity';
import type { SocialMediaGeneration } from '../../../domain/entities/social-media-generation.entity';

@ApiTags('Social Media')
@ApiBearerAuth()
@Controller('social-media')
@UseGuards(JwtAuthGuard, CaslGuard)
export class SocialMediaController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ── POST /social-media/generate-topics ────────────────────────────────────
  @Post('generate-topics')
  @Throttle({ socialMediaGenerate: { limit: 5, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Create, subject: 'SOCIAL_MEDIA' })
  @ApiCreatedResponse({ type: [SocialMediaTopicResponse] })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async findTopics(
    @Body(new ZodValidationPipe(FindTopicsSchema)) dto: FindTopicsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SocialMediaTopic[]> {
    return this.queryBus.execute(new FindTopicsQuery(dto));
  }

  // ── POST /social-media/generate-content ───────────────────────────────────
  @Post('generate-content')
  @Throttle({ socialMediaGenerate: { limit: 5, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Create, subject: 'SOCIAL_MEDIA' })
  @ApiCreatedResponse({ type: GeneratePostJobResultDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async generate(
    @Body(new ZodValidationPipe(GeneratePostSchema)) dto: GeneratePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratePostJobResultDto> {
    const result = await this.commandBus.execute(
      new GeneratePostCommand(dto, user.id),
    );
    return result;
  }

  // ── GET /social-media ─────────────────────────────────────────────────────
  @Get()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'SOCIAL_MEDIA' })
  @ApiOkResponse({ type: PaginatedSocialMediaResponse })
  async list(
    @Query(new ZodValidationPipe(ListSocialMediaSchema))
    query: ListSocialMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSocialMediaResponse> {
    const result = await this.queryBus.execute(
      new ListSocialMediaQuery(query, user.id),
    );
    return result;
  }

  // ── GET /social-media/:id ─────────────────────────────────────────────────
  @Get(':id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'SOCIAL_MEDIA' })
  @ApiOkResponse({ type: SocialMediaGenerationResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', description: 'Social media generation UUID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SocialMediaGenerationResponse> {
    const result = await this.queryBus.execute(
      new GetSocialMediaByIdQuery(id, user.id),
    );
    return result;
  }

  // ── DELETE /social-media/:id (hard delete) ────────────────────────────────
  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'SOCIAL_MEDIA' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', description: 'Social media generation UUID' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteSocialMediaCommand(id, user.id));
  }

  // ── POST /social-media/bulk-delete (hard delete) ──────────────────────────
  @Post('bulk-delete')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'SOCIAL_MEDIA' })
  @ApiOkResponse({ schema: { properties: { count: { type: 'number' } } } })
  @ApiBadRequestResponse()
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkDeleteSocialMediaCommand(dto.ids, user.id),
    );
  }

  // ── POST /social-media/export ─────────────────────────────────────────────
  @Post('export')
  @SkipCache()
  @CheckAbilities({ action: Action.Export, subject: 'SOCIAL_MEDIA' })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({ description: 'File download' })
  async export(
    @Body(new ZodValidationPipe(ExportSocialMediaSchema))
    dto: ExportSocialMediaDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result: ExportSocialMediaResult = await this.commandBus.execute(
      new ExportSocialMediaCommand(dto, user.id),
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ── POST /social-media/:id/download-zip ───────────────────────────────────────
  @Post(':id/download-zip')
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'SOCIAL_MEDIA' })
  @ApiProduces('application/zip')
  @ApiOkResponse({ description: 'ZIP file download' })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', description: 'Social media generation UUID' })
  async downloadZip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result: DownloadZipResult = await this.commandBus.execute(
      new DownloadZipCommand(id, user.id),
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }
}
