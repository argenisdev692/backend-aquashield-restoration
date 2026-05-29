import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';

import { TwoFactorRequiredGuard } from '../../guards/two-factor-required.guard';
import { FreshPasswordGuard } from '../../guards/fresh-password.guard';

import { SetupTotpUseCase } from '../../../application/use-cases/setup-totp.use-case';
import { EnableTotpUseCase } from '../../../application/use-cases/enable-totp.use-case';
import { DisableTotpUseCase } from '../../../application/use-cases/disable-totp.use-case';
import { RegenerateBackupCodesUseCase } from '../../../application/use-cases/regenerate-backup-codes.use-case';
import { EnableTotpDto } from '../../../application/dto/enable-totp.dto';

/**
 * All endpoints here are AUTHENTICATED + behind:
 *   - `JwtAuthGuard` (you must be logged in),
 *   - `TwoFactorRequiredGuard` (your token's `tfa` claim must be true —
 *     mid-challenge tokens cannot configure 2FA),
 *   - `FreshPasswordGuard` (you must have confirmed your password within
 *     5 minutes — mirrors Laravel `confirm.password`).
 *
 * `setup` is the only route that runs WITHOUT FreshPasswordGuard so the
 * user can preview the QR code without re-entering the password each
 * time. Enabling, disabling, and regenerating ARE gated.
 */
@ApiTags('auth:2fa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TwoFactorRequiredGuard)
// Hard cap on every 2FA management endpoint — they all mutate the security
// posture of the account, so we deliberately keep the per-IP budget low.
@Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
@Controller('auth/two-factor')
export class TwoFactorController {
  constructor(
    private readonly setupUc: SetupTotpUseCase,
    private readonly enableUc: EnableTotpUseCase,
    private readonly disableUc: DisableTotpUseCase,
    private readonly regenerateUc: RegenerateBackupCodesUseCase,
  ) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FreshPasswordGuard)
  @ApiOperation({ summary: 'Start TOTP setup — returns the secret + QR code' })
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.setupUc.execute(user.id);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FreshPasswordGuard)
  @UsePipes(new ZodValidationPipe(EnableTotpDto))
  @ApiOperation({ summary: 'Confirm setup with a TOTP code and receive backup codes' })
  enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableTotpDto,
  ) {
    return this.enableUc.execute({ userId: user.id, input: dto });
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FreshPasswordGuard)
  @ApiOperation({ summary: 'Disable TOTP and wipe backup codes + trusted devices' })
  async disable(@CurrentUser() user: AuthenticatedUser) {
    await this.disableUc.execute(user.id);
    return { disabled: true };
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FreshPasswordGuard)
  @ApiOperation({ summary: 'Regenerate 8 new backup codes (shown once)' })
  regenerate(@CurrentUser() user: AuthenticatedUser) {
    return this.regenerateUc.execute(user.id);
  }
}
