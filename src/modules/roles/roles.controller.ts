import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Res,
  StreamableFile,
  ForbiddenException,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import { SkipThrottle } from '@nestjs/throttler';
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Action } from '../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../core/access/actions.enum';
import { CaslAbilityFactory } from '../../core/access/casl-ability.factory';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { resolveTrashedMode } from '../../shared/crud/trashed.util';
import { RolesService } from './roles.service';
import { CreateRoleDto, CreateRoleSchema } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRoleSchema } from './dto/update-role.dto';
import {
  RolesListQueryDto,
  RolesListQuerySchema,
  GetRoleQueryDto,
  GetRoleQuerySchema,
} from './dto/roles-list-query.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { BulkIdsDto, BulkIdsSchema } from './dto/bulk-ids.dto';
import {
  AttachPermissionDto,
  AttachPermissionSchema,
} from './dto/attach-permission.dto';
import type { Response } from 'express';
import type { Role } from './roles.entity';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, CaslGuard)
export class RolesController {
  constructor(
    private readonly service: RolesService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Create, subject: 'ROLE' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateRoleSchema)) dto: CreateRoleDto,
  ): Promise<Role> {
    return this.service.create(dto, user.id);
  }

  @Get('trash')
  @SkipThrottle()
  @ApiOkResponse({ type: [RoleResponseDto] })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'ROLE' })
  async findTrash(): Promise<{ data: Role[]; total: number }> {
    const result = await this.service.findAll(100, 0, undefined, 'only');
    return {
      data: result.data,
      total: result.total,
    };
  }

  @Get()
  @SkipThrottle()
  @ApiOkResponse({ type: [RoleResponseDto] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted roles.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description: 'Return only soft-deleted roles.',
  })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'ROLE' })
  async findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(RolesListQuerySchema))
    query: RolesListQueryDto,
  ): Promise<{ data: Role[]; total: number }> {
    await this.assertCanViewTombstones(actor, query);
    const skip = (query.page - 1) * query.limit;
    const trashed = resolveTrashedMode({
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });
    const result = await this.service.findAll(query.limit, skip, query.search, trashed);
    return {
      data: result.data,
      total: result.total,
    };
  }

  @Get('export')
  @SkipCache()
  @ApiOkResponse({
    description: 'Binary export of roles (CSV, XLSX, or PDF).',
    content: { 'application/octet-stream': {} },
  })
  @CheckAbilities({ action: Action.Read, subject: 'ROLE' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'format', required: true, enum: ['csv', 'xlsx', 'pdf'] })
  @ApiQuery({ name: 'withTrashed', required: false, type: Boolean })
  @ApiQuery({ name: 'onlyTrashed', required: false, type: Boolean })
  async export(
    @Query(new ZodValidationPipe(RolesListQuerySchema))
    query: RolesListQueryDto,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.assertCanViewTombstones(actor, query);
    const { buffer, filename, contentType } = await this.service.exportRoles(
      query,
      format,
      actor.id,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'When `true`, return the role even if soft-deleted.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'ROLE' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(GetRoleQuerySchema)) query: GetRoleQueryDto,
  ): Promise<Role> {
    return this.service.findById(id, query.withTrashed === true);
  }

  @Patch(':id')
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'ROLE' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
  ): Promise<Role> {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'ROLE' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.service.delete(id, user.id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'ROLE' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Role> {
    return this.service.restore(id, user.id);
  }

  @Post(':id/permissions')
  @HttpCode(200)
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse({
    description: 'Role or referenced permission not found',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'ROLE' })
  async attachPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AttachPermissionSchema))
    dto: AttachPermissionDto,
  ): Promise<Role> {
    return this.service.attachPermission(id, dto, user.id);
  }

  @Delete(':id/permissions/:permissionId')
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'Role or attached permission not found',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'permissionId', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Update, subject: 'ROLE' })
  async detachPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.service.detachPermission(id, permissionId, user.id);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Delete, subject: 'ROLE' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.service.bulkDelete(dto.ids, user.id);
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Restore, subject: 'ROLE' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.service.bulkRestore(dto.ids, user.id);
  }

  private async assertCanViewTombstones(
    actor: AuthenticatedUser,
    query: { onlyTrashed?: boolean },
  ): Promise<void> {
    if (!query.onlyTrashed) return;
    const ability = await this.abilityFactory.createForUser(actor);
    if (!ability.can(Action.Restore, 'ROLE')) {
      throw new ForbiddenException(
        'Viewing suspended roles requires the Restore ROLE ability',
      );
    }
  }
}
