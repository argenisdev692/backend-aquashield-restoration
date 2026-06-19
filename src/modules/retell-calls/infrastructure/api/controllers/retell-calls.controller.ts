import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { CaslAbilityFactory } from '../../../../../core/access/casl-ability.factory';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import {
  CallFiltersDto,
  CallFiltersSchema,
} from '../../../application/dtos/call-filters.dto';
import {
  ExportCallsDto,
  ExportCallsSchema,
} from '../../../application/dtos/export-calls.dto';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';
import { GetCallsListUseCase } from '../../../application/use-cases/get-calls-list.use-case';
import { GetCallByIdUseCase } from '../../../application/use-cases/get-call-by-id.use-case';
import { MarkCallReadUseCase } from '../../../application/use-cases/mark-call-read.use-case';
import { DeleteCallUseCase } from '../../../application/use-cases/delete-call.use-case';
import { RestoreCallUseCase } from '../../../application/use-cases/restore-call.use-case';
import { BulkDeleteCallsUseCase } from '../../../application/use-cases/bulk-delete-calls.use-case';
import { BulkRestoreCallsUseCase } from '../../../application/use-cases/bulk-restore-calls.use-case';
import { ExportCallsUseCase } from '../../../application/use-cases/export-calls.use-case';
import { SyncCallsUseCase } from '../../../application/use-cases/sync-calls.use-case';
import {
  CallResponse,
  toCallView,
  type CallView,
} from '../presenters/call.response';
import { CallListResponse } from '../presenters/call-list.response';

interface CallListView {
  data: CallView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@ApiTags('Retell Calls')
@ApiBearerAuth()
@Controller('retell/calls')
@UseGuards(JwtAuthGuard, CaslGuard)
export class RetellCallsController {
  constructor(
    private readonly getList: GetCallsListUseCase,
    private readonly getById: GetCallByIdUseCase,
    private readonly markReadUseCase: MarkCallReadUseCase,
    private readonly deleteUseCase: DeleteCallUseCase,
    private readonly restoreUseCase: RestoreCallUseCase,
    private readonly bulkDeleteUseCase: BulkDeleteCallsUseCase,
    private readonly bulkRestoreUseCase: BulkRestoreCallsUseCase,
    private readonly exportUseCase: ExportCallsUseCase,
    private readonly syncUseCase: SyncCallsUseCase,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  // `?status=suspended` / `?onlyTrashed=true` is gated by `Action.Restore`.
  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'CALL_RECORD' })
  @ApiOkResponse({ type: CallListResponse })
  @ApiForbiddenResponse({
    description:
      '`status=suspended` / `onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'callStatus', required: false, type: String })
  @ApiQuery({
    name: 'userSentiment',
    required: false,
    enum: ['Negative', 'Positive', 'Neutral', 'Unknown'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'suspended', 'all'],
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: String,
    example: '2024-06-01',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: String,
    example: '2024-06-30',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findAll(
    @Query(new ZodValidationPipe(CallFiltersSchema)) query: CallFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallListView> {
    await this.assertCanReadTrash(query, user);
    const result = await this.getList.execute(query);
    return { ...result, data: result.data.map(toCallView) };
  }

  // Registered BEFORE `:id` to avoid route shadowing.
  @Get('export')
  @CheckAbilities({ action: Action.Export, subject: 'CALL_RECORD' })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({
    description: 'CSV, XLSX (default) or PDF report of call records.',
  })
  @ApiForbiddenResponse({
    description:
      '`status=suspended` / `onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx', 'pdf'] })
  @SkipCache()
  async export(
    @Query(new ZodValidationPipe(ExportCallsSchema)) query: ExportCallsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.assertCanReadTrash(query, user);
    const result = await this.exportUseCase.execute(query, user.id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return new StreamableFile(result.buffer);
  }

  @Post('sync')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Update, subject: 'CALL_RECORD' })
  @ApiOkResponse({
    schema: { example: { fetched: 50, created: 12, updated: 38 } },
  })
  async sync(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ fetched: number; created: number; updated: number }> {
    return this.syncUseCase.execute(100, user.id);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'CALL_RECORD' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    const count = await this.bulkDeleteUseCase.execute(dto.ids, user.id);
    return { count };
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'CALL_RECORD' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    const count = await this.bulkRestoreUseCase.execute(dto.ids, user.id);
    return { count };
  }

  // A single-record fetch may surface a soft-deleted (tombstoned) row ONLY for
  // a caller who also holds `Action.Restore`. A `Action.Read`-only user must
  // not be able to pivot through `GET /:id` to read deleted records — that is
  // the same enumeration guard the list/export routes enforce.
  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'CALL_RECORD' })
  @ApiOkResponse({ type: CallResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallView> {
    const ability = await this.abilityFactory.createForUser(user);
    const withTrashed = ability.can(Action.Restore, 'CALL_RECORD');
    const call = await this.getById.execute(id, withTrashed);
    return toCallView(call);
  }

  @Patch(':id/read')
  @CheckAbilities({ action: Action.Update, subject: 'CALL_RECORD' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.markReadUseCase.execute(id, user.id);
    return { success: true };
  }

  @Post(':id/restore')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'CALL_RECORD' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.restoreUseCase.execute(id, user.id);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'CALL_RECORD' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteUseCase.execute(id, user.id);
  }

  /**
   * Enumerating tombstoned rows requires `Action.Restore` (not `Action.Read`)
   * so the standard read role cannot pivot through `?status=suspended` /
   * `?onlyTrashed=true`.
   */
  private async assertCanReadTrash(
    query: { status?: string; onlyTrashed?: boolean },
    user: AuthenticatedUser,
  ): Promise<void> {
    const wantsTrash =
      query.status === 'suspended' || query.onlyTrashed === true;
    if (!wantsTrash) return;
    const ability = await this.abilityFactory.createForUser(user);
    if (!ability.can(Action.Restore, 'CALL_RECORD')) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
