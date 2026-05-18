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
import {
  CreateAppointmentDto,
  CreateAppointmentSchema,
} from '../../../application/dtos/create-appointment.dto';
import {
  UpdateAppointmentDto,
  UpdateAppointmentSchema,
} from '../../../application/dtos/update-appointment.dto';
import { AppointmentFiltersDto } from '../../../application/dtos/appointment-filters.dto';
import { CreateAppointmentUseCase } from '../../../application/use-cases/create-appointment.use-case';
import { UpdateAppointmentUseCase } from '../../../application/use-cases/update-appointment.use-case';
import { DeleteAppointmentUseCase } from '../../../application/use-cases/delete-appointment.use-case';
import { GetAppointmentByIdUseCase } from '../../../application/use-cases/get-appointment-by-id.use-case';
import { GetAppointmentsListUseCase } from '../../../application/use-cases/get-appointments-list.use-case';
import { ExportAppointmentsUseCase } from '../../../application/use-cases/export-appointments.use-case';
import type {
  AppointmentReadModel,
  PaginatedResult,
} from '../../../domain/repositories/appointment-repository.interface';
import { AppointmentResponse } from '../presenters/appointment.response';
import { AppointmentListResponse } from '../presenters/appointment-list.response';
import { CreateAppointmentResponse } from '../presenters/create-appointment.response';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, CaslGuard)
export class AppointmentsController {
  constructor(
    private readonly createAppointment: CreateAppointmentUseCase,
    private readonly updateAppointment: UpdateAppointmentUseCase,
    private readonly deleteAppointment: DeleteAppointmentUseCase,
    private readonly getAppointmentById: GetAppointmentByIdUseCase,
    private readonly getAppointmentsList: GetAppointmentsListUseCase,
    private readonly exportAppointments: ExportAppointmentsUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: CreateAppointmentResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  async create(
    @Body(new ZodValidationPipe(CreateAppointmentSchema))
    dto: CreateAppointmentDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CreateAppointmentResponse> {
    const id = await this.createAppointment.execute(dto, userId);
    return { id };
  }

  @Get()
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
  @CacheTTL(TTL_SECONDS.SHORT)
  async findAll(
    @Query() query: AppointmentFiltersDto,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    return this.getAppointmentsList.execute(query);
  }

  @Get('export')
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
  @ApiProduces('application/json')
  @CacheTTL(TTL_SECONDS.SHORT)
  async export(
    @Query() query: AppointmentFiltersDto,
    @Query('format') format: 'xlsx' | 'pdf' = 'xlsx',
    @CurrentUser('userId') userId: string,
  ): Promise<AppointmentReadModel[]> {
    return this.exportAppointments.execute(query, format, userId);
  }

  @Get(':id')
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentReadModel> {
    const appointment = await this.getAppointmentById.execute(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    return appointment;
  }

  @Patch(':id')
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
    await this.updateAppointment.execute(id, dto, userId);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.deleteAppointment.execute(id, userId);
  }
}
