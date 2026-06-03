import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CacheTTL } from '@nestjs/cache-manager';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { JwtLogoutGuard } from '../../../../../core/guards/jwt-logout.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';

import { RegisterDto } from '../../../application/dto/register.dto';
import { VerifyEmailDto } from '../../../application/dto/verify-email.dto';
import { ResendVerificationCodeDto } from '../../../application/dto/resend-verification-code.dto';
import { LoginDto } from '../../../application/dto/login.dto';
import { RefreshTokenDto } from '../../../application/dto/refresh-token.dto';
import { VerifyTwoFactorChallengeDto } from '../../../application/dto/verify-two-factor-challenge.dto';
import { RequestPasswordResetDto } from '../../../application/dto/request-password-reset.dto';
import { ResetPasswordDto } from '../../../application/dto/reset-password.dto';
import { ChangePasswordDto } from '../../../application/dto/change-password.dto';

import { RegisterUseCase } from '../../../application/use-cases/register.use-case';
import { VerifyEmailUseCase } from '../../../application/use-cases/verify-email.use-case';
import { ResendVerificationCodeUseCase } from '../../../application/use-cases/resend-verification-code.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { VerifyTwoFactorChallengeUseCase } from '../../../application/use-cases/verify-two-factor-challenge.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { LogoutAllDevicesUseCase } from '../../../application/use-cases/logout-all-devices.use-case';
import { GetMeUseCase } from '../../../application/use-cases/get-me.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case';
import { UpdateMyProfileUseCase } from '../../../application/use-cases/update-my-profile.use-case';
import {
  UploadProfilePhotoUseCase,
  type UploadResult,
} from '../../../application/use-cases/upload-profile-photo.use-case';
import { UpdateProfileDto } from '../../../application/dto/update-profile.dto';
import { TRUSTED_DEVICE_TTL_DAYS } from '../../../domain/entities/trusted-device.entity';
import { TwoFactorRequiredGuard } from '../../guards/two-factor-required.guard';

const TRUSTED_DEVICE_COOKIE = 'td';

/**
 * Thin HTTP layer. Each route validates its body with the ZodValidationPipe
 * and forwards to ONE UseCase. No business logic here.
 *
 * Throttling: register / login / forgot-password / resend-code are wrapped
 * in route-level `@Throttle(...)` to add a hard IP cap on top of the
 * per-account counters in Redis.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUc: RegisterUseCase,
    private readonly verifyEmailUc: VerifyEmailUseCase,
    private readonly resendVerificationUc: ResendVerificationCodeUseCase,
    private readonly loginUc: LoginUseCase,
    private readonly verify2faUc: VerifyTwoFactorChallengeUseCase,
    private readonly refreshUc: RefreshTokenUseCase,
    private readonly logoutUc: LogoutUseCase,
    private readonly logoutAllUc: LogoutAllDevicesUseCase,
    private readonly getMeUc: GetMeUseCase,
    private readonly requestPasswordResetUc: RequestPasswordResetUseCase,
    private readonly resetPasswordUc: ResetPasswordUseCase,
    private readonly changePasswordUc: ChangePasswordUseCase,
    private readonly updateProfileUc: UpdateMyProfileUseCase,
    private readonly uploadPhotoUc: UploadProfilePhotoUseCase,
  ) {}

  // ─── Public auth flow ───────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RegisterDto))
  @ApiOperation({ summary: 'Register a new user — sends a 6-digit verification code by email' })
  register(@Body() dto: RegisterDto) {
    return this.registerUc.execute(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(VerifyEmailDto))
  @ApiOperation({ summary: 'Verify a registration email with the 6-digit OTP' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailUc.execute(dto);
    return { verified: true };
  }

  @Post('resend-verification-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(ResendVerificationCodeDto))
  @ApiOperation({ summary: 'Resend the email-verification code (60 s throttle per email)' })
  resendVerificationCode(@Body() dto: ResendVerificationCodeDto) {
    return this.resendVerificationUc.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginDto))
  @ApiOperation({ summary: 'Password login (returns tokens, or a 2FA challenge if enabled)' })
  login(@Body() dto: LoginDto) {
    return this.loginUc.execute(dto);
  }

  @Post('two-factor/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 5 * 60_000 } })
  @UsePipes(new ZodValidationPipe(VerifyTwoFactorChallengeDto))
  @ApiOperation({ summary: 'Complete the 2FA challenge with a TOTP or backup code' })
  async verifyTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTwoFactorChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!user.sessionId) throw new UnauthorizedException('Stale token');

    const out = await this.verify2faUc.execute({
      userId: user.id,
      sessionId: user.sessionId,
      input: dto,
    });

    if (out.trustedDeviceToken) {
      res.cookie(TRUSTED_DEVICE_COOKIE, out.trustedDeviceToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    return out.tokens;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RefreshTokenDto))
  @ApiOperation({ summary: 'Rotate the refresh token + emit a fresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshUc.execute(dto);
  }

  // ─── Password lifecycle ─────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @UsePipes(new ZodValidationPipe(RequestPasswordResetDto))
  @ApiOperation({ summary: 'Send a 6-digit password-reset code (silent no-op on unknown email)' })
  forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.requestPasswordResetUc.execute(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UsePipes(new ZodValidationPipe(ResetPasswordDto))
  @ApiOperation({ summary: 'Consume reset code + set new password; revokes ALL sessions' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUc.execute(dto);
    return { reset: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TwoFactorRequiredGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UsePipes(new ZodValidationPipe(ChangePasswordDto))
  @ApiOperation({ summary: 'Authenticated user changes their own password; keeps current session' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUc.execute({
      userId: user.id,
      currentSessionId: user.sessionId,
      input: dto,
    });
    return { changed: true };
  }

  // ─── Authenticated routes ───────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtLogoutGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke the calling session' })
  logout(@CurrentUser() user?: AuthenticatedUser) {
    // Idempotent: no valid token → nothing to revoke server-side, still 204.
    if (!user) return;
    return this.logoutUc.execute(user.id, user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke every other session (keep the current one)' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.logoutAllUc.execute({
      userId: user.id,
      currentSessionId: user.sessionId,
      keepCurrent: true,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipCache()
  @CacheTTL(0)
  @ApiOperation({ summary: 'Current user identity, profile, roles + effective permissions' })
  @ApiOkResponse({ description: 'Identity snapshot' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.getMeUc.execute(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TwoFactorRequiredGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(UpdateProfileDto))
  @ApiOperation({ summary: 'Update own profile (whitelist of non-auth columns)' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.updateProfileUc.execute(user.id, dto);
    return this.getMeUc.execute(user.id);
  }

  @Post('me/profile-photo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TwoFactorRequiredGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB upload cap (sharp re-validates)
      fileFilter: (_req, file, cb) => {
        cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
      },
    }),
  )
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upload / replace own profile photo (R2 via circuit breaker)' })
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File field "file" is required');
    }
    return this.uploadPhotoUc.execute({
      userId: user.id,
      file: { buffer: file.buffer, mimetype: file.mimetype },
    });
  }
}
