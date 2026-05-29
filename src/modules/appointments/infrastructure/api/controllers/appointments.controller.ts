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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import {
  CreateAppointmentDto,
  CreateAppointmentSchema,
} from '../../../application/dtos/create-appointment.dto';
import {
  UpdateAppointmentDto,
  UpdateAppointmentSchema,
} from '../../../application/dtos/update-appointment.dto';
import { AppointmentFiltersDto } from '../../../application/dtos/appointment-filters.dto';
import {
  ExportAppointmentsDto,
  ExportAppointmentsSchema,
} from '../../../application/dtos/export-appointments.dto';
import { CreateAppointmentCommand } from '../../../application/commands/create-appointment.command';
import { UpdateAppointmentCommand } from '../../../application/commands/update-appointment.command';
import { DeleteAppointmentCommand } from '../../../application/commands/delete-appointment.command';
import { GetAppointmentByIdQuery } from '../../../application/queries/get-appointment-by-id.query';
import { GetAppointmentsListQuery } from '../../../application/queries/get-appointments-list.query';
import {
  ExportAppointmentsQuery,
  type ExportAppointmentsResult,
} from '../../../application/queries/export-appointments.query';
import { MarkAppointmentReadCommand } from '../../../application/commands/mark-appointment-read.command';
import { RestoreAppointmentCommand } from '../../../application/commands/restore-appointment.command';
import { BulkDeleteAppointmentsCommand } from '../../../application/commands/bulk-delete-appointments.command';
import { BulkRestoreAppointmentsCommand } from '../../../application/commands/bulk-restore-appointments.command';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';
import type {
  AppointmentReadModel,
  PaginatedResult,
} from '../../../domain/repositories/appointment-repository.interface';
import { AppointmentResponse } from '../presenters/appointment.response';
import { AppointmentListResponse } from '../presenters/appointment-list.response';
import { CreateAppointmentResponse } from '../presenters/create-appointment.response';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { CaslAbilityFactory } from '../../../../../core/access/casl-ability.factory';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, CaslGuard)
export class AppointmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'APPOINTMENT' })
  @ApiCreatedResponse({ type: CreateAppointmentResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  async create(
    @Body(new ZodValidationPipe(CreateAppointmentSchema))
    dto: CreateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateAppointmentResponse> {
    const id = await this.commandBus.execute(
      new CreateAppointmentCommand(dto, user.id),
    );
    return { id };
  }

  // `?onlyTrashed=true` is additionally gated by `Action.Restore` inside the
  // handler so a read-only role cannot enumerate tombstoned rows.
  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'APPOINTMENT' })
  @ApiOkResponse({ type: AppointmentListResponse })
  @ApiForbiddenResponse({
    description: '`onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({
    name: 'statusLead',
    required: false,
    enum: ['New', 'Called', 'Pending', 'Declined'],
  })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'owner', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: Date,
    description: 'Filter appointments created on or after this date (inclusive).',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: Date,
    description: 'Filter appointments created on or before this date (inclusive).',
  })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'Include soft-deleted appointments alongside active ones (Laravel `withTrashed()`).',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Return ONLY soft-deleted appointments. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findAll(
    @Query() query: AppointmentFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    await this.assertCanReadTrash(query.onlyTrashed, user);
    const range = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });
    return this.queryBus.execute(new GetAppointmentsListQuery(query, range));
  }

  // Registered BEFORE `:id` to avoid route shadowing. Bypasses cache, audited
  // as `appointments.export`. `?onlyTrashed=true` requires `Action.Restore`.
  @Get('export')
  @CheckAbilities({ action: Action.Read, subject: 'APPOINTMENT' })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({
    description:
      'CSV, XLSX (default) or PDF report of appointments. Honors filters and trashed flags.',
    content: {
      'text/csv': {},
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
      'application/pdf': {},
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({
    description: '`onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx', 'pdf'] })
  @ApiQuery({
    name: 'statusLead',
    required: false,
    enum: ['New', 'Called', 'Pending', 'Declined'],
  })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'owner', required: false, type: String })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted appointments in the export.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: Date,
    description: 'Filter appointments created on or after this date (inclusive).',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: Date,
    description: 'Filter appointments created on or before this date (inclusive).',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Export ONLY soft-deleted appointments. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
  })
  @SkipCache()
  async export(
    @Query(new ZodValidationPipe(ExportAppointmentsSchema))
    query: ExportAppointmentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.assertCanReadTrash(query.onlyTrashed, user);
    const range = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });
    const result = await this.queryBus.execute<
      ExportAppointmentsQuery,
      ExportAppointmentsResult
    >(new ExportAppointmentsQuery(query, query.format, user.id, range));

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return new StreamableFile(result.buffer);
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'APPOINTMENT' })
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'When `true`, return the appointment even if it has been soft-deleted. Without it, soft-deleted rows yield 404.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('withTrashed') withTrashedRaw?: string,
  ): Promise<AppointmentReadModel> {
    const withTrashed = withTrashedRaw === 'true';
    return this.queryBus.execute(new GetAppointmentByIdQuery(id, withTrashed));
  }

  @Patch(':id')
  @HttpCode(204)
  @CheckAbilities({ action: Action.Update, subject: 'APPOINTMENT' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateAppointmentSchema))
    dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdateAppointmentCommand(id, dto, user.id),
    );
  }

  @Patch(':id/read')
  @CheckAbilities({ action: Action.Update, subject: 'APPOINTMENT' })
  @ApiOkResponse({
    description: 'Marked as read',
    schema: { example: { success: true } },
  })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.commandBus.execute(new MarkAppointmentReadCommand(id, user.id));
    return { success: true };
  }

  @Patch(':id/restore')
  @CheckAbilities({ action: Action.Restore, subject: 'APPOINTMENT' })
  @ApiOkResponse({
    description: 'Restored',
    schema: { example: { success: true } },
  })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.commandBus.execute(new RestoreAppointmentCommand(id, user.id));
    return { success: true };
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'APPOINTMENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkDeleteAppointmentsCommand(dto.ids, user.id),
    );
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'APPOINTMENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkRestoreAppointmentsCommand(dto.ids, user.id),
    );
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'APPOINTMENT' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteAppointmentCommand(id, user.id));
  }

  /**
   * Enumerating tombstoned rows requires `Action.Restore` (not `Action.Read`)
   * so the standard read role cannot pivot through `?onlyTrashed=true`.
   */
  private async assertCanReadTrash(
    onlyTrashed: boolean | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!onlyTrashed) return;
    const ability = await this.abilityFactory.createForUser(user);
    if (!ability.can(Action.Restore, 'APPOINTMENT')) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
