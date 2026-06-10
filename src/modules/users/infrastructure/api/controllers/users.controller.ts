import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  Inject,
  NotFoundException,
  ParseUUIDPipe,
  StreamableFile,
  Res,
  BadRequestException,
  ForbiddenException,
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
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import { permittedFieldsOf } from '@casl/ability/extra';
import type { Response } from 'express';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import { CaslAbilityFactory } from '../../../../../core/access/casl-ability.factory';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type {
  AppAbility,
  AuthenticatedUser,
} from '../../../../../core/access/actions.enum';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import {
  STORAGE_PORT,
  type IStoragePort,
} from '../../../../../shared/storage/storage.port';

import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CreateUserCommand } from '../../../application/commands/create-user.command';
import { SetupPasswordCommand } from '../../../application/commands/setup-password.command';
import { RequestPasswordChangeCommand } from '../../../application/commands/request-password-change.command';
import { ChangePasswordCommand } from '../../../application/commands/change-password.command';
import { GetUserByIdQuery } from '../../../application/queries/get-user-by-id.query';
import { GetUsersListQuery } from '../../../application/queries/get-users-list.query';
import { UpdateUserCommand } from '../../../application/commands/update-user.command';
import { DeleteUserCommand } from '../../../application/commands/delete-user.command';
import { BulkDeleteUsersCommand } from '../../../application/commands/bulk-delete-users.command';
import { BulkRestoreUsersCommand } from '../../../application/commands/bulk-restore-users.command';
import { ExportUsersCommand } from '../../../application/commands/export-users.command';
import { CheckEmailExistsQuery } from '../../../application/queries/check-email-exists.query';
import { CheckUsernameExistsQuery } from '../../../application/queries/check-username-exists.query';
import type { UserReadModel } from '../../../application/read-models/user.read-model';
import type { PaginatedUsers } from '../../../application/queries/handlers/get-users-list.handler';
import { formatPhonePretty } from '../../../../../shared/phone/phone.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';

import {
  CreateUserDto,
  CreateUserSchema,
} from '../../../application/dtos/create-user.dto';
import {
  UpdateUserDto,
  UpdateUserSchema,
} from '../../../application/dtos/update-user.dto';
import {
  SetupPasswordDto,
  SetupPasswordSchema,
} from '../../../application/dtos/setup-password.dto';
import {
  RequestPasswordChangeDto,
  RequestPasswordChangeSchema,
} from '../../../application/dtos/request-password-change.dto';
import {
  ChangePasswordDto,
  ChangePasswordSchema,
} from '../../../application/dtos/change-password.dto';
import {
  UsersListQueryDto,
  UsersListQuerySchema,
  type UsersListQuery,
} from '../../../application/dtos/users-list-query.dto';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';

import {
  UserResponse,
  MessageResponse,
  UserListResponse,
} from '../presenters/user.response';

/**
 * Field allowlist for `UserResponse`. Used by `permittedFieldsOf` so a CASL
 * rule with a `fields[]` constraint can narrow what the actor sees, while
 * rules without `fields[]` fall back to "every field allowed".
 */
const USER_RESPONSE_FIELDS = [
  'id',
  'name',
  'lastName',
  'username',
  'email',
  'phone',
  'emailVerifiedAt',
  'passwordConfirmedAt',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'roles',
  'permissions',
  'dateOfBirth',
  'address',
  'address2',
  'zipCode',
  'city',
  'state',
  'country',
  'gender',
  'profilePhotoUrl',
  'totpEnabled',
  'mustChangePassword',
] as const;

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly abilityFactory: CaslAbilityFactory,
    @Inject(STORAGE_PORT)
    private readonly storage: IStoragePort,
  ) {}

  /**
   * Gates body-driven ACL mutations. `@CheckAbilities` runs before body
   * parsing, so we can't declare `Action.Manage USER` statically — the
   * requirement only kicks in when the request actually carries roleIds
   * or permissionIds.
   */
  private async assertCanManageAcl(
    actor: AuthenticatedUser,
    dto: { roleIds?: string[]; permissionIds?: string[] },
  ): Promise<void> {
    if (dto.roleIds === undefined && dto.permissionIds === undefined) return;
    const ability = await this.abilityFactory.createForUser(actor);
    if (!ability.can(Action.Manage, 'USER')) {
      throw new ForbiddenException(
        'Managing roles/permissions requires the Manage USER ability',
      );
    }
  }

  /**
   * Tombstone-list enumeration is gated by `Action.Restore`, not `Action.Read`
   * — otherwise any `Read USER` viewer could list suspended accounts.
   */
  private async assertCanViewTombstones(
    actor: AuthenticatedUser,
    query: { onlyTrashed?: boolean },
  ): Promise<void> {
    if (!query.onlyTrashed) return;
    const ability = await this.abilityFactory.createForUser(actor);
    if (!ability.can(Action.Restore, 'USER')) {
      throw new ForbiddenException(
        'Viewing suspended users requires the Restore USER ability',
      );
    }
  }

  private toResponse(u: UserReadModel): UserResponse {
    return {
      id: u.id,
      name: u.name,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      phone: formatPhonePretty(u.phone),
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      passwordConfirmedAt: u.passwordConfirmedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      deletedAt: u.deletedAt?.toISOString() ?? null,
      roles: u.roles,
      permissions: u.permissions,
      dateOfBirth: u.dateOfBirth
        ? u.dateOfBirth.toISOString().slice(0, 10)
        : null,
      address: u.address,
      address2: u.address2,
      zipCode: u.zipCode,
      city: u.city,
      state: u.state,
      country: u.country,
      gender: u.gender,
      profilePhotoUrl: u.profilePhotoPath
        ? this.storage.publicUrl(u.profilePhotoPath)
        : null,
      totpEnabled: u.totpEnabled,
      mustChangePassword: u.mustChangePassword,
    };
  }

  /**
   * Field-level CASL filter. If the actor's `Read USER` rules carry a
   * `fields[]` allowlist, anything outside it is stripped; `id` always
   * stays so the client can correlate the row. Rules without `fields[]`
   * yield the full response.
   */
  private filterReadableFields(
    response: UserResponse,
    ability: AppAbility,
  ): UserResponse {
    const allowed = permittedFieldsOf(ability, Action.Read, 'USER', {
      fieldsFrom: (rule) => rule.fields ?? [...USER_RESPONSE_FIELDS],
    });
    if (allowed.length === USER_RESPONSE_FIELDS.length) return response;

    const filtered: Record<string, unknown> = { id: response.id };
    for (const field of USER_RESPONSE_FIELDS) {
      if (field === 'id' || allowed.includes(field)) {
        filtered[field] = (response as unknown as Record<string, unknown>)[
          field
        ];
      }
    }
    // `as unknown as`: `UserResponse` is the strict zod-derived shape, but a
    // CASL `fields[]` rule may legitimately omit non-`id` fields. The runtime
    // value is a partial — only the keys CASL approved — which TypeScript
    // cannot prove from the loop above.
    return filtered as unknown as UserResponse;
  }

  private async present(
    actor: AuthenticatedUser,
    u: UserReadModel,
  ): Promise<UserResponse> {
    const ability = await this.abilityFactory.createForUser(actor);
    return this.filterReadableFields(this.toResponse(u), ability);
  }

  @Post()
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Create, subject: 'USER' })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UserResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponse> {
    await this.assertCanManageAcl(actor, dto);
    const id = await this.commandBus.execute<CreateUserCommand, string>(
      new CreateUserCommand(dto, actor.id),
    );
    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      UserReadModel | null
    >(new GetUserByIdQuery(id));
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return this.present(actor, user);
  }

  @Post('setup-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired setup token' })
  async setupPassword(
    @Body(new ZodValidationPipe(SetupPasswordSchema)) dto: SetupPasswordDto,
  ): Promise<MessageResponse> {
    await this.commandBus.execute(new SetupPasswordCommand(dto));
    return {
      message: 'Password has been set successfully. You can now log in.',
    };
  }

  @Post('request-password-change')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async requestPasswordChange(
    @Body(new ZodValidationPipe(RequestPasswordChangeSchema))
    dto: RequestPasswordChangeDto,
  ): Promise<MessageResponse> {
    await this.commandBus.execute(new RequestPasswordChangeCommand(dto));
    return {
      message:
        'If an account with that email exists, a password change link has been sent.',
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired change password token',
  })
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    await this.commandBus.execute(new ChangePasswordCommand(dto));
    return { message: 'Password has been changed successfully.' };
  }

  @Get()
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({ type: UserListResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'Include suspended (soft-deleted) users alongside active ones. Laravel-style `withTrashed()`.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Return ONLY suspended users — useful for audit reports. Laravel-style `onlyTrashed()`. Cannot be combined with `withTrashed`. Requires the `Restore USER` ability.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: String,
    example: '2024-06-01',
    description: 'Filter by creation date (inclusive start). Format: YYYY-MM-DD.',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: String,
    example: '2024-06-01',
    description: 'Filter by creation date (inclusive end). Format: YYYY-MM-DD.',
  })
  async findAll(
    @Query(new ZodValidationPipe(UsersListQuerySchema))
    query: UsersListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserListResponse> {
    await this.assertCanViewTombstones(actor, query);
    const result = await this.queryBus.execute<
      GetUsersListQuery,
      PaginatedUsers
    >(new GetUsersListQuery(query));
    const ability = await this.abilityFactory.createForUser(actor);
    return {
      data: result.data.map((u) =>
        this.filterReadableFields(this.toResponse(u), ability),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  @ApiBearerAuth()
  @SkipCache()
  @Throttle({ default: { limit: 1, ttl: 30_000 } })
  @ApiOkResponse({
    description: 'Binary file',
    content: { 'application/octet-stream': {} },
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include suspended users in the export.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Export ONLY suspended users (audit report of deactivated accounts). Requires the `Restore USER` ability.',
  })
  async export(
    @Query(new ZodValidationPipe(UsersListQuerySchema))
    query: UsersListQuery,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.assertCanViewTombstones(actor, query);
    const fmt: 'xlsx' | 'pdf' = format === 'pdf' ? 'pdf' : 'xlsx';
    const buffer = await this.commandBus.execute(
      new ExportUsersCommand(query, fmt, actor.id),
    );

    const contentTypes = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    } as const;

    res.set({
      'Content-Type': contentTypes[fmt],
      'Content-Disposition': `attachment; filename="users.${fmt}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('check/email')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({
    schema: { type: 'object', properties: { exists: { type: 'boolean' } } },
  })
  @ApiQuery({ name: 'value', required: true, type: String })
  @ApiQuery({
    name: 'excludeId',
    required: false,
    type: String,
    format: 'uuid',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async checkEmail(
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ exists: boolean }> {
    if (!value || value.trim().length === 0)
      throw new BadRequestException('value is required');
    const exists = await this.queryBus.execute(
      new CheckEmailExistsQuery(value.trim(), excludeId),
    );
    return { exists };
  }

  @Get('check/username')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({
    schema: { type: 'object', properties: { exists: { type: 'boolean' } } },
  })
  @ApiQuery({ name: 'value', required: true, type: String })
  @ApiQuery({
    name: 'excludeId',
    required: false,
    type: String,
    format: 'uuid',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async checkUsername(
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ exists: boolean }> {
    if (!value || value.trim().length === 0)
      throw new BadRequestException('value is required');
    const exists = await this.queryBus.execute(
      new CheckUsernameExistsQuery(value.trim(), excludeId),
    );
    return { exists };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'When `true`, return the user even if it has been suspended (soft-deleted). Without it the endpoint behaves like `Model::find()` and returns 404 for suspended rows.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query('withTrashed') withTrashedRaw?: string,
  ): Promise<UserResponse> {
    const withTrashed = withTrashedRaw === 'true';
    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      UserReadModel | null
    >(new GetUserByIdQuery(id, withTrashed));
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return this.present(actor, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponse> {
    await this.assertCanManageAcl(actor, dto);
    await this.commandBus.execute(new UpdateUserCommand(id, dto, actor.id));
    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      UserReadModel | null
    >(new GetUserByIdQuery(id));
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return this.present(actor, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Delete, subject: 'USER' })
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteUserCommand(id, actor.id));
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Delete, subject: 'USER' })
  @ApiBearerAuth()
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkDeleteUsersCommand(dto.ids, actor.id),
    );
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Restore, subject: 'USER' })
  @ApiBearerAuth()
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkRestoreUsersCommand(dto.ids, actor.id),
    );
  }
}
