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
  NotFoundException,
  ParseUUIDPipe,
  StreamableFile,
  Res,
  BadRequestException,
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
import type { Response } from 'express';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';

import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case';
import { SetupPasswordUseCase } from '../../../application/use-cases/setup-password.use-case';
import { RequestPasswordChangeUseCase } from '../../../application/use-cases/request-password-change.use-case';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case';
import { GetUserByIdUseCase } from '../../../application/use-cases/get-user-by-id.use-case';
import { GetUsersListUseCase } from '../../../application/use-cases/get-users-list.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../../application/use-cases/delete-user.use-case';
import { ExportUsersUseCase } from '../../../application/use-cases/export-users.use-case';
import { CheckEmailExistsUseCase } from '../../../application/use-cases/check-email-exists.use-case';
import { CheckUsernameExistsUseCase } from '../../../application/use-cases/check-username-exists.use-case';

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
  UserResponse,
  MessageResponse,
  UserListResponse,
} from '../presenters/user.response';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUC: CreateUserUseCase,
    private readonly setupPasswordUC: SetupPasswordUseCase,
    private readonly requestPasswordChangeUC: RequestPasswordChangeUseCase,
    private readonly changePasswordUC: ChangePasswordUseCase,
    private readonly getUserByIdUC: GetUserByIdUseCase,
    private readonly getUsersListUC: GetUsersListUseCase,
    private readonly updateUserUC: UpdateUserUseCase,
    private readonly deleteUserUC: DeleteUserUseCase,
    private readonly exportUsersUC: ExportUsersUseCase,
    private readonly checkEmailExistsUC: CheckEmailExistsUseCase,
    private readonly checkUsernameExistsUC: CheckUsernameExistsUseCase,
  ) {}

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
    const id = await this.createUserUC.execute(dto, actor.id);
    return {
      id,
      name: dto.name,
      lastName: dto.lastName ?? null,
      email: dto.email,
      emailVerifiedAt: null,
      passwordConfirmedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
    await this.setupPasswordUC.execute(dto);
    return { message: 'Password has been set successfully. You can now log in.' };
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
    await this.requestPasswordChangeUC.execute(dto);
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
    await this.changePasswordUC.execute(dto);
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
  async findAll(
    @Query(new ZodValidationPipe(UsersListQuerySchema))
    query: UsersListQueryDto,
  ): Promise<UserListResponse> {
    const result = await this.getUsersListUC.execute(query);
    return {
      data: result.data.map((u) => ({
        id: u.id,
        name: u.name,
        lastName: u.lastName,
        email: u.email,
        emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
        passwordConfirmedAt: u.passwordConfirmedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
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
  async export(
    @Query(new ZodValidationPipe(UsersListQuerySchema))
    query: UsersListQuery,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fmt: 'xlsx' | 'pdf' = format === 'pdf' ? 'pdf' : 'xlsx';
    const buffer = await this.exportUsersUC.execute(query, fmt, actor.id);

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({ schema: { type: 'object', properties: { exists: { type: 'boolean' } } } })
  @ApiQuery({ name: 'value', required: true, type: String })
  @ApiQuery({ name: 'excludeId', required: false, type: String, format: 'uuid' })
  @ApiUnauthorizedResponse()
  async checkEmail(
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ exists: boolean }> {
    if (!value || value.trim().length === 0) throw new BadRequestException('value is required');
    const exists = await this.checkEmailExistsUC.execute(value.trim(), excludeId);
    return { exists };
  }

  @Get('check/username')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOkResponse({ schema: { type: 'object', properties: { exists: { type: 'boolean' } } } })
  @ApiQuery({ name: 'value', required: true, type: String })
  @ApiQuery({ name: 'excludeId', required: false, type: String, format: 'uuid' })
  @ApiUnauthorizedResponse()
  async checkUsername(
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ exists: boolean }> {
    if (!value || value.trim().length === 0) throw new BadRequestException('value is required');
    const exists = await this.checkUsernameExistsUC.execute(value.trim(), excludeId);
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
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponse> {
    const user = await this.getUserByIdUC.execute(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      passwordConfirmedAt: user.passwordConfirmedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
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
  ): Promise<MessageResponse> {
    await this.updateUserUC.execute(id, dto, actor.id);
    return { message: 'User updated successfully' };
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
    await this.deleteUserUC.execute(id, actor.id);
  }
}
