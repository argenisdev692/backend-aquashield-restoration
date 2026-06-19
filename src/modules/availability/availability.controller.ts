import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiParam,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Action, type AuthenticatedUser } from '../../core/access/actions.enum';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { AvailabilityService } from './availability.service';
import { UpsertRuleSchema, type UpsertRuleDto } from './dto/upsert-rule.dto';
import { CreateExceptionSchema, type CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionSchema, type UpdateExceptionDto } from './dto/update-exception.dto';
import {
  ExceptionFilterSchema,
  ExceptionExportQuerySchema,
  type ExceptionFilterDto,
  type ExceptionExportQueryDto,
} from './dto/exception-filter.dto';
import { AvailabilityRuleResponse } from './dto/availability-rule.response.dto';
import {
  AvailabilityExceptionResponse,
  PaginatedExceptionResponse,
} from './dto/availability-exception.response.dto';
import type { AvailabilityRuleEntity, AvailabilityExceptionEntity } from './availability.repository';

@ApiTags('Availability (Admin)')
@ApiBearerAuth()
@Controller('availability')
@UseGuards(JwtAuthGuard, CaslGuard)
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  // ──────────────────────────────
  //  Rules
  // ──────────────────────────────

  @Get('rules')
  @SkipThrottle()
  @CacheTTL(TTL_SECONDS.LONG)
  @ApiOperation({ summary: 'List all 7 weekly availability rules' })
  @ApiOkResponse({ type: [AvailabilityRuleResponse], description: 'Array of weekly rules (day 0=Sun … 6=Sat)' })
  @CheckAbilities({ action: Action.Read, subject: 'AVAILABILITY_RULE' })
  async getRules(): Promise<AvailabilityRuleEntity[]> {
    return this.service.getRules();
  }

  @Put('rules/:dayOfWeek')
  @SkipCache()
  @ApiOperation({ summary: 'Create or update a weekly availability rule' })
  @ApiParam({ name: 'dayOfWeek', type: Number, example: 1, description: '0=Sun … 6=Sat' })
  @ApiOkResponse({ type: AvailabilityRuleResponse, description: 'Rule upserted' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Update, subject: 'AVAILABILITY_RULE' })
  async upsertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body(new ZodValidationPipe(UpsertRuleSchema)) dto: UpsertRuleDto,
  ): Promise<AvailabilityRuleEntity> {
    return this.service.upsertRule(user.id, dayOfWeek, dto);
  }

  // ──────────────────────────────
  //  Exceptions — trash route BEFORE :id routes
  // ──────────────────────────────

  @Get('exceptions/trash')
  @SkipThrottle()
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOperation({ summary: 'List soft-deleted exceptions (trash bin)' })
  @ApiOkResponse({ type: PaginatedExceptionResponse, description: 'Paginated list of deleted exceptions' })
  @CheckAbilities({ action: Action.Restore, subject: 'AVAILABILITY_EXCEPTION' })
  async listDeletedExceptions(
    @Query(new ZodValidationPipe(ExceptionFilterSchema)) query: ExceptionFilterDto,
  ): Promise<{ data: AvailabilityExceptionEntity[]; total: number }> {
    return this.service.listDeletedExceptions(query);
  }

  @Get('exceptions/export')
  @SkipThrottle()
  @SkipCache()
  @ApiOperation({ summary: 'Export availability exceptions to CSV or XLSX' })
  @ApiOkResponse({
    description: 'Binary file download',
    content: { 'application/octet-stream': {} },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({ name: 'format', required: true, enum: ['csv', 'xlsx'] })
  @CheckAbilities({ action: Action.Export, subject: 'AVAILABILITY_EXCEPTION' })
  async exportExceptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ExceptionExportQuerySchema)) query: ExceptionExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } = await this.service.exportExceptions(user.id, query);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('exceptions')
  @SkipThrottle()
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @ApiOperation({ summary: 'List availability exceptions (holidays, closures)' })
  @ApiOkResponse({ type: PaginatedExceptionResponse, description: 'Paginated list of exceptions' })
  @CheckAbilities({ action: Action.Read, subject: 'AVAILABILITY_EXCEPTION' })
  async listExceptions(
    @Query(new ZodValidationPipe(ExceptionFilterSchema)) query: ExceptionFilterDto,
  ): Promise<{ data: AvailabilityExceptionEntity[]; total: number }> {
    return this.service.listExceptions(query);
  }

  @Post('exceptions')
  @SkipCache()
  @ApiOperation({ summary: 'Create a date exception (holiday or closure)' })
  @ApiCreatedResponse({ type: AvailabilityExceptionResponse, description: 'Exception created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Exception for this date already exists' })
  @CheckAbilities({ action: Action.Create, subject: 'AVAILABILITY_EXCEPTION' })
  async createException(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateExceptionSchema)) dto: CreateExceptionDto,
  ): Promise<AvailabilityExceptionEntity> {
    return this.service.createException(user.id, dto);
  }

  @Patch('exceptions/:id')
  @SkipCache()
  @ApiOperation({ summary: 'Update an existing exception' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AvailabilityExceptionResponse, description: 'Exception updated' })
  @ApiNotFoundResponse({ description: 'Exception not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Update, subject: 'AVAILABILITY_EXCEPTION' })
  async updateException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateExceptionSchema)) dto: UpdateExceptionDto,
  ): Promise<AvailabilityExceptionEntity> {
    return this.service.updateException(user.id, id, dto);
  }

  @Delete('exceptions/:id')
  @SkipCache()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an exception' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Exception deleted' })
  @ApiNotFoundResponse({ description: 'Exception not found' })
  @CheckAbilities({ action: Action.Delete, subject: 'AVAILABILITY_EXCEPTION' })
  async deleteException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteException(user.id, id);
  }

  @Post('exceptions/:id/restore')
  @SkipCache()
  @ApiOperation({ summary: 'Restore a soft-deleted exception' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AvailabilityExceptionResponse, description: 'Exception restored' })
  @ApiNotFoundResponse({ description: 'Deleted exception not found' })
  @CheckAbilities({ action: Action.Restore, subject: 'AVAILABILITY_EXCEPTION' })
  async restoreException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AvailabilityExceptionEntity> {
    return this.service.restoreException(user.id, id);
  }
}
