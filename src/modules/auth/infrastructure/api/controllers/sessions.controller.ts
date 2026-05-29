import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CacheTTL } from '@nestjs/cache-manager';

import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';

import { TwoFactorRequiredGuard } from '../../guards/two-factor-required.guard';
import { ListActiveSessionsUseCase } from '../../../application/use-cases/list-active-sessions.use-case';
import { RevokeSessionUseCase } from '../../../application/use-cases/revoke-session.use-case';
import { ListTrustedDevicesUseCase } from '../../../application/use-cases/list-trusted-devices.use-case';
import { RevokeTrustedDeviceUseCase } from '../../../application/use-cases/revoke-trusted-device.use-case';

/**
 * Self-service device management. All routes require an authenticated user
 * AND a tfa-satisfied token (mid-challenge tokens cannot manage devices).
 *
 * `GET /auth/sessions` and `GET /auth/trusted-devices` are explicitly
 * marked `@SkipCache()` because the list mutates every login / logout /
 * trust-this-device action — caching even briefly would show stale info
 * after the user revoked a session from another tab.
 */
@ApiTags('auth:sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TwoFactorRequiredGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly listSessionsUc: ListActiveSessionsUseCase,
    private readonly revokeSessionUc: RevokeSessionUseCase,
    private readonly listTrustedUc: ListTrustedDevicesUseCase,
    private readonly revokeTrustedUc: RevokeTrustedDeviceUseCase,
  ) {}

  @Get('sessions')
  @SkipCache()
  @CacheTTL(0)
  @ApiOperation({ summary: 'List active sessions for the caller' })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.listSessionsUc.execute({
      userId: user.id,
      currentSessionId: user.sessionId,
    });
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one of own sessions by id' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.revokeSessionUc.execute({ userId: user.id, sessionId: id });
  }

  @Get('trusted-devices')
  @SkipCache()
  @CacheTTL(0)
  @ApiOperation({ summary: 'List trusted devices (30-day cookies) for the caller' })
  listTrustedDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.listTrustedUc.execute(user.id);
  }

  @Delete('trusted-devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a single trusted device' })
  async revokeTrustedDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.revokeTrustedUc.revokeOne({ userId: user.id, deviceId: id });
  }

  @Delete('trusted-devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke ALL trusted devices' })
  revokeAllTrustedDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.revokeTrustedUc.revokeAll(user.id);
  }
}
