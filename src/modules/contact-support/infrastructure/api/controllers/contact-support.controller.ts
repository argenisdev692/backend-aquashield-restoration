import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  ForbiddenException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CacheTTL } from '@nestjs/cache-manager';
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
import { CaslAbilityFactory } from '../../../../../core/access/casl-ability.factory';
import { stringBoolean } from '../../../../../shared/crud/trashed.util';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';
import { CreateContactSupportUseCase } from '../../../application/use-cases/create-contact-support.use-case';
import { MarkContactSupportReadUseCase } from '../../../application/use-cases/mark-contact-support-read.use-case';
import { DeleteContactSupportUseCase } from '../../../application/use-cases/delete-contact-support.use-case';
import { RestoreContactSupportUseCase } from '../../../application/use-cases/restore-contact-support.use-case';
import { BulkDeleteContactSupportUseCase } from '../../../application/use-cases/bulk-delete-contact-support.use-case';
import { BulkRestoreContactSupportUseCase } from '../../../application/use-cases/bulk-restore-contact-support.use-case';
import { GetContactSupportByIdUseCase } from '../../../application/use-cases/get-contact-support-by-id.use-case';
import { ListContactSupportUseCase } from '../../../application/use-cases/list-contact-support.use-case';
import { ExportContactSupportUseCase } from '../../../application/use-cases/export-contact-support.use-case';
import {
  CreateContactSupportDto,
  CreateContactSupportSchema,
} from '../../../application/dtos/create-contact-support.dto';
import {
  ListContactSupportDto,
  ListContactSupportSchema,
} from '../../../application/dtos/list-contact-support.dto';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';
import {
  ExportContactSupportDto,
  ExportContactSupportSchema,
} from '../../../application/dtos/export-contact-support.dto';
import {
  ContactSupportResponse,
  ContactSupportListResponse,
  CreateContactSupportResponse,
} from '../presenters/contact-support.response';
import type { ContactSupportReadModel } from '../../../domain/read-models/contact-support.read-model';
import type { PaginatedContactSupport } from '../../../domain/read-models/contact-support.read-model';

@ApiTags('contact-support')
@Controller('contact-support')
export class ContactSupportController {
  constructor(
    private readonly createUseCase: CreateContactSupportUseCase,
    private readonly markAsReadUseCase: MarkContactSupportReadUseCase,
    private readonly deleteUseCase: DeleteContactSupportUseCase,
    private readonly restoreUseCase: RestoreContactSupportUseCase,
    private readonly bulkDeleteUseCase: BulkDeleteContactSupportUseCase,
    private readonly bulkRestoreUseCase: BulkRestoreContactSupportUseCase,
    private readonly getUseCase: GetContactSupportByIdUseCase,
    private readonly listUseCase: ListContactSupportUseCase,
    private readonly exportUseCase: ExportContactSupportUseCase,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  // ── Public — anonymous contact form ───────────────────────────
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiCreatedResponse({ type: CreateContactSupportResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(CreateContactSupportSchema))
    dto: CreateContactSupportDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CreateContactSupportResponse> {
    const id = await this.createUseCase.execute(dto, user?.id);
    return { id };
  }

  // ── Admin — super-admin / admin only (CASL: CONTACT) ──────────
  // `?onlyTrashed=true` is additionally gated by `Action.Restore` inside the
  // handler so a read-only role cannot enumerate tombstoned rows.
  @Get()
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CONTACT' })
  @ApiOkResponse({ type: ContactSupportListResponse })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'readed', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted requests (Laravel `withTrashed()`).',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Return ONLY soft-deleted requests. Cannot be combined with `withTrashed`.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: Date,
    description: 'Filter by creation date (inclusive start).',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: Date,
    description: 'Filter by creation date (inclusive end).',
  })
  async list(
    @Query(new ZodValidationPipe(ListContactSupportSchema))
    query: ListContactSupportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedContactSupport> {
    // Enumerating tombstoned rows requires Action.Restore — not Action.Read.
    if (query.onlyTrashed) {
      const ability = await this.abilityFactory.createForUser(user);
      if (!ability.can(Action.Restore, 'CONTACT')) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    const trashed = resolveTrashedMode({
      status: undefined,
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });
    return this.listUseCase.execute({
      page: query.page,
      limit: query.limit,
      readed: query.readed,
      trashed,
      range,
    });
  }

  // ── Export — must be registered BEFORE `:id` to avoid route shadowing.
  // Bypasses cache, audited as `contact_support.export`, and `?onlyTrashed=true`
  // additionally requires `Action.Restore` to prevent enumeration of deletions.
  @Get('export')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'CONTACT' })
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOkResponse({
    description: 'CSV (default) or PDF report of contact-support requests.',
    content: {
      'text/csv': {},
      'application/pdf': {},
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'pdf'] })
  @ApiQuery({ name: 'readed', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted requests in the export.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Export ONLY soft-deleted requests. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: Date,
    description: 'Filter by creation date (inclusive start).',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: Date,
    description: 'Filter by creation date (inclusive end).',
  })
  async export(
    @Query(new ZodValidationPipe(ExportContactSupportSchema))
    query: ExportContactSupportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (query.onlyTrashed) {
      const ability = await this.abilityFactory.createForUser(user);
      if (!ability.can(Action.Restore, 'CONTACT')) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    const trashed = resolveTrashedMode({
      status: undefined,
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });
    const result = await this.exportUseCase.execute({
      format: query.format,
      actorId: user.id,
      readed: query.readed,
      trashed,
      range,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return new StreamableFile(result.buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CONTACT' })
  @ApiOkResponse({ type: ContactSupportResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'When `true`, return the request even if it has been soft-deleted.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('withTrashed', new ZodValidationPipe(stringBoolean.optional()))
    withTrashed?: boolean,
  ): Promise<ContactSupportReadModel> {
    return this.getUseCase.execute(id, withTrashed ?? false);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CheckAbilities({ action: Action.Update, subject: 'CONTACT' })
  @ApiOkResponse({ description: 'Marked as read' })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.markAsReadUseCase.execute(id, user.id);
    return { success: true };
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CheckAbilities({ action: Action.Restore, subject: 'CONTACT' })
  @ApiOkResponse({ description: 'Restored' })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.restoreUseCase.execute(id, user.id);
    return { success: true };
  }

  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'CONTACT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.bulkDeleteUseCase.execute(dto.ids, user.id);
  }

  @Post('bulk-restore')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'CONTACT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.bulkRestoreUseCase.execute(dto.ids, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'CONTACT' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteUseCase.execute(id, user.id);
  }
}
