import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Action } from '../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../core/access/actions.enum';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import { UserPermissionsService } from './user-permissions.service';
import type { UserPermission } from './user-permission.entity';
import {
  UpsertUserPermissionDto,
  UpsertUserPermissionSchema,
} from './dto/upsert-user-permission.dto';
import { UserPermissionResponseDto } from './dto/user-permission.response';

/**
 * Direct (per-user) permission overrides. Grants extra ALLOWs on top of the
 * roles' ruleset, or sets `isGranted: false` for an explicit DENY that wins
 * over any matching role-inherited ALLOW.
 *
 * Mounted at `/users/:userId/permissions` so it reads as a sub-resource of
 * the user, even though it lives in a dedicated Flat CRUD module (the
 * primary `users` module is Hex/DDD and keeps its CQRS shape untouched).
 */
@ApiTags('User Permissions')
@ApiBearerAuth()
@Controller('users/:userId/permissions')
@UseGuards(JwtAuthGuard, CaslGuard)
export class UserPermissionsController {
  constructor(private readonly service: UserPermissionsService) {}

  @Get()
  @SkipCache()
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: [UserPermissionResponseDto] })
  @ApiNotFoundResponse({ description: 'User not found' })
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  async list(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserPermission[]> {
    return this.service.listForUser(userId);
  }

  @Post()
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: UserPermissionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'User or permission not found' })
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  async upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpsertUserPermissionSchema))
    dto: UpsertUserPermissionDto,
  ): Promise<UserPermission> {
    return this.service.upsert(userId, dto, actor.id);
  }

  @Delete(':permissionId')
  @HttpCode(204)
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiParam({ name: 'permissionId', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'User not found, or the override is not attached',
  })
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  async remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.service.remove(userId, permissionId, actor.id);
  }
}
