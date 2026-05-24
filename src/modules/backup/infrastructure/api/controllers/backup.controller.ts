import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';

import { RunBackupCommand } from '../../../application/commands/run-backup.command';
import { DeleteBackupCommand } from '../../../application/commands/delete-backup.command';
import { GetBackupsListQuery } from '../../../application/queries/get-backups-list.query';
import { GetBackupByIdQuery } from '../../../application/queries/get-backup-by-id.query';
import { GetBackupDownloadQuery } from '../../../application/queries/get-backup-download.query';
import type { BackupReadModel } from '../../../application/read-models/backup.read-model';
import type { PaginatedBackups } from '../../../domain/ports/backup.repository.interface';
import type { BackupDownload } from '../../../application/queries/handlers/get-backup-download.handler';
import { BackupTrigger } from '../../../domain/value-objects/backup-status.vo';
import {
  ListBackupsQueryDto,
  ListBackupsQuerySchema,
} from '../../../application/dtos/list-backups.dto';
import {
  BackupListResponse,
  BackupResponse,
  BackupTriggeredResponse,
} from '../presenters/backup.response';

@ApiTags('backups')
@ApiBearerAuth()
@Controller('backups')
@UseGuards(JwtAuthGuard, CaslGuard)
export class BackupController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  private toResponse(b: BackupReadModel): BackupResponse {
    return {
      id: b.id,
      status: b.status,
      triggeredBy: b.triggeredBy,
      actorId: b.actorId,
      objectKey: b.objectKey,
      sizeBytes: b.sizeBytes,
      checksum: b.checksum,
      error: b.error,
      startedAt: b.startedAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }

  @Post('run')
  @HttpCode(201)
  @CheckAbilities({ action: Action.Create, subject: 'DATABASE_BACKUP' })
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @ApiCreatedResponse({ type: BackupTriggeredResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async trigger(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BackupTriggeredResponse> {
    const id = await this.commandBus.execute<RunBackupCommand, string>(
      new RunBackupCommand(BackupTrigger.Manual, actor.id),
    );
    return { id };
  }

  @Get()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'DATABASE_BACKUP' })
  @ApiOkResponse({ type: BackupListResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAll(
    @Query(new ZodValidationPipe(ListBackupsQuerySchema))
    query: ListBackupsQueryDto,
  ): Promise<BackupListResponse> {
    const result = await this.queryBus.execute<
      GetBackupsListQuery,
      PaginatedBackups
    >(new GetBackupsListQuery(query.page, query.limit));
    return {
      data: result.data.map((b) => this.toResponse(b)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id/download')
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'DATABASE_BACKUP' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({
    description: 'Binary pg_dump artifact (PostgreSQL custom format)',
    content: { 'application/octet-stream': {} },
  })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description: 'Backup is not in COMPLETED state and cannot be downloaded',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const download = await this.queryBus.execute<
        GetBackupDownloadQuery,
        BackupDownload
      >(new GetBackupDownloadQuery(id));
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(download.contentLength),
        'Content-Disposition': `attachment; filename="${download.filename}"`,
      });
      return new StreamableFile(download.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) throw new NotFoundException(message);
      if (message.includes('cannot be downloaded') || message.includes('no downloadable')) {
        throw new BadRequestException(message);
      }
      throw err;
    }
  }

  @Get(':id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'DATABASE_BACKUP' })
  @ApiOkResponse({ type: BackupResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BackupResponse> {
    const backup = await this.queryBus.execute<
      GetBackupByIdQuery,
      BackupReadModel | null
    >(new GetBackupByIdQuery(id));
    if (!backup) throw new NotFoundException(`Backup with id ${id} not found`);
    return this.toResponse(backup);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'DATABASE_BACKUP' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.commandBus.execute(new DeleteBackupCommand(id, actor.id));
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }
}
