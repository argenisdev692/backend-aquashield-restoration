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
  NotFoundException,
} from '@nestjs/common';
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
import { CreateAppointmentCommand } from '../../../application/commands/create-appointment.command';
import { UpdateAppointmentCommand } from '../../../application/commands/update-appointment.command';
import { DeleteAppointmentCommand } from '../../../application/commands/delete-appointment.command';
import { GetAppointmentByIdQuery } from '../../../application/queries/get-appointment-by-id.query';
import { GetAppointmentsListQuery } from '../../../application/queries/get-appointments-list.query';
import { ExportAppointmentsQuery } from '../../../application/queries/export-appointments.query';
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

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, CaslGuard)
export class AppointmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'APPOINTMENT' })
  @ApiCreatedResponse({ type: CreateAppointmentResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  async create(
    @Body(new ZodValidationPipe(CreateAppointmentSchema))
    dto: CreateAppointmentDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CreateAppointmentResponse> {
    const id = await this.commandBus.execute(
      new CreateAppointmentCommand(dto, userId),
    );
    return { id };
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'APPOINTMENT' })
  @ApiOkResponse({ type: AppointmentListResponse })
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
      'Return ONLY soft-deleted appointments — useful for audit reports. Cannot be combined with `withTrashed`.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findAll(
    @Query() query: AppointmentFiltersDto,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    return this.queryBus.execute(new GetAppointmentsListQuery(query));
  }

  @Get('export')
  @CheckAbilities({ action: Action.Read, subject: 'APPOINTMENT' })
  @ApiOkResponse({ description: 'Exported appointments data' })
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'pdf'] })
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
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Export ONLY soft-deleted appointments (audit report of deactivated leads).',
  })
  @ApiProduces('application/json')
  @SkipCache()
  async export(
    @Query() query: AppointmentFiltersDto,
    @Query('format') format: 'xlsx' | 'pdf' = 'xlsx',
    @CurrentUser('userId') userId: string,
  ): Promise<AppointmentReadModel[]> {
    return this.queryBus.execute(
      new ExportAppointmentsQuery(query, format, userId),
    );
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
    const appointment = await this.queryBus.execute(
      new GetAppointmentByIdQuery(id, withTrashed),
    );
    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    return appointment;
  }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'APPOINTMENT' })
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateAppointmentSchema))
    dto: UpdateAppointmentDto,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateAppointmentCommand(id, dto, userId));
  }

  @Patch(':id/read')
  @CheckAbilities({ action: Action.Update, subject: 'APPOINTMENT' })
  @ApiOkResponse({ description: 'Marked as read' })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: true }> {
    await this.commandBus.execute(new MarkAppointmentReadCommand(id, userId));
    return { success: true };
  }

  @Patch(':id/restore')
  @CheckAbilities({ action: Action.Restore, subject: 'APPOINTMENT' })
  @ApiOkResponse({ description: 'Restored' })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: true }> {
    await this.commandBus.execute(new RestoreAppointmentCommand(id, userId));
    return { success: true };
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'APPOINTMENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkDeleteAppointmentsCommand(dto.ids, userId),
    );
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'APPOINTMENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkRestoreAppointmentsCommand(dto.ids, userId),
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
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteAppointmentCommand(id, userId));
  }
}
