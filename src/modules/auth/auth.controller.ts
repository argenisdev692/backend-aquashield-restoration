import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import type { AuthenticatedUser } from '../../core/access/actions.enum';
import { FreshPasswordGuard } from './guards/fresh-password.guard';
import { AuthService } from './auth.service';
import { formatPhonePretty } from '../../shared/phone/phone.util';

import { LoginDto, LoginSchema } from './dto/login.dto';
import { LogoutDto, LogoutSchema } from './dto/logout.dto';
import { RefreshTokenDto, RefreshTokenSchema } from './dto/refresh-token.dto';
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import {
  UpdateProfileDto,
  UpdateProfileSchema,
} from './dto/update-profile.dto';
import {
  RequestPasswordResetDto,
  RequestPasswordResetSchema,
} from './dto/request-password-reset.dto';
import {
  ResetPasswordDto,
  ResetPasswordSchema,
} from './dto/reset-password.dto';
import {
  ConfirmPasswordDto,
  ConfirmPasswordSchema,
} from './dto/confirm-password.dto';
import {
  VerifyTwoFactorChallengeDto,
  VerifyTwoFactorChallengeSchema,
} from './dto/verify-two-factor-challenge.dto';
import { GoogleAuthDto, GoogleAuthSchema } from './dto/google-auth.dto';
import { VerifyOtpDto, VerifyOtpSchema } from './dto/verify-otp.dto';
import { Confirm2faDto, Confirm2faSchema } from './dto/confirm-2fa.dto';
import { VerifyTotpDto, VerifyTotpSchema } from './dto/verify-totp.dto';
import {
  ChangeExpiredPasswordDto,
  ChangeExpiredPasswordSchema,
} from './dto/change-expired-password.dto';

import {
  LoginResponse,
  TokenResponse,
  TwoFactorSetupResponse,
  MessageResponse,
  RegisterResponse,
  ForgotPasswordResponse,
  ResetTokenValidationResponse,
  EmailVerificationStatusResponse,
  PasswordConfirmationStatusResponse,
  TwoFactorChallengeInfoResponse,
  TwoFactorChallengeResponse,
  MeResponse,
  GoogleAuthResponse,
  VerifyOtpResponse,
  Confirm2faResponse,
  RegenerateBackupCodesResponse,
  SessionsResponse,
  TrustedDevicesResponse,
} from './presenters/auth.response';

const TRUSTED_DEVICE_COOKIE = 'td';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Authentication ────────────────────────────────────────────────────────

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('change-expired-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiBadRequestResponse({
    description: 'Validation failed or password reuse detected',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired password change token',
  })
  async changeExpiredPassword(
    @Body(new ZodValidationPipe(ChangeExpiredPasswordSchema))
    dto: ChangeExpiredPasswordDto,
  ): Promise<TokenResponse> {
    return this.authService.changeExpiredPassword(dto);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto,
  ): Promise<void> {
    await this.authService.logout(user.id, dto);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logoutAll(user.id);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ): Promise<TokenResponse> {
    return this.authService.refreshToken(dto);
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiCreatedResponse({ type: RegisterResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Profile photo file' })
  @ApiOkResponse({ type: MeResponse })
  @ApiBadRequestResponse({ description: 'Invalid file' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ): Promise<MeResponse> {
    return this.authService.uploadProfilePhoto(user.id, file);
  }

  // ─── Password Reset ─────────────────────────────────────────────────────

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: ForgotPasswordResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async requestPasswordReset(
    @Body(new ZodValidationPipe(RequestPasswordResetSchema))
    dto: RequestPasswordResetDto,
  ): Promise<ForgotPasswordResponse> {
    return this.authService.requestPasswordReset(dto);
  }

  @Get('reset-password/:token')
  @ApiOkResponse({ type: ResetTokenValidationResponse })
  @ApiBadRequestResponse({ description: 'Invalid or expired token' })
  async validateResetToken(
    @Param('token') token: string,
  ): Promise<ResetTokenValidationResponse> {
    return this.authService.validateResetToken(token);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid token' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.resetPassword(dto);
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  @Get('email/verify/:userId/:hash')
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Invalid verification link' })
  async verifyEmail(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('hash') hash: string,
  ): Promise<MessageResponse> {
    return this.authService.verifyEmail(userId, hash);
  }

  @Post('email/verification-notification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.authService.resendVerificationEmail(user.id);
  }

  // ─── Password Confirmation ─────────────────────────────────────────────────

  @Get('user/confirm-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PasswordConfirmationStatusResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async passwordConfirmationStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PasswordConfirmationStatusResponse> {
    return this.authService.getPasswordConfirmationStatus(user.id);
  }

  @Post('user/confirm-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async confirmPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ConfirmPasswordSchema)) dto: ConfirmPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.confirmPassword(user.id, dto);
  }

  // ─── Two-Factor Challenge ──────────────────────────────────────────────────

  @Get('two-factor-challenge')
  @ApiOkResponse({ type: TwoFactorChallengeInfoResponse })
  @ApiQuery({ name: 'email', required: true, type: String })
  twoFactorChallengeInfo(
    @Query('email') email: string,
  ): TwoFactorChallengeInfoResponse {
    return {
      email,
      challengeType: 'otp',
      message:
        'Submit your 4-digit OTP (type: otp) or 6-digit TOTP code (type: totp) to POST /auth/two-factor-challenge.',
    };
  }

  @Post('two-factor-challenge')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: TwoFactorChallengeResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired code' })
  async twoFactorChallenge(
    @Body(new ZodValidationPipe(VerifyTwoFactorChallengeSchema))
    dto: VerifyTwoFactorChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TwoFactorChallengeResponse> {
    const result = await this.authService.verifyTwoFactorChallenge(dto);
    if (result.trustedDeviceToken && result.trustedDeviceTtlMs) {
      res.cookie(TRUSTED_DEVICE_COOKIE, result.trustedDeviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: result.trustedDeviceTtlMs,
        path: '/',
      });
    }
    const {
      trustedDeviceToken: _t,
      trustedDeviceTtlMs: _ttl,
      ...body
    } = result;
    return body;
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionsResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionsResponse> {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.authService.revokeSession(user.id, id);
  }

  // ─── Trusted Devices ───────────────────────────────────────────────────────

  @Get('trusted-devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: TrustedDevicesResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listTrustedDevices(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrustedDevicesResponse> {
    return this.authService.listTrustedDevices(user.id);
  }

  @Delete('trusted-devices/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Password confirmation required' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async revokeTrustedDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.revokeTrustedDevice(user.id, id);
    res.clearCookie(TRUSTED_DEVICE_COOKIE, { path: '/' });
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  @Post('google-auth')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ type: GoogleAuthResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid Google ID token' })
  async googleAuth(
    @Body(new ZodValidationPipe(GoogleAuthSchema)) dto: GoogleAuthDto,
  ): Promise<GoogleAuthResponse> {
    return this.authService.googleAuth(dto);
  }

  // ─── 2FA Management ───────────────────────────────────────────────────────

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: TwoFactorSetupResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Password confirmation required' })
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponse> {
    return this.authService.enable2fa(user.id, user.email ?? '');
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: Confirm2faResponse })
  @ApiBadRequestResponse({ description: 'Invalid TOTP code' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Password confirmation required' })
  async confirm2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(Confirm2faSchema)) dto: Confirm2faDto,
  ): Promise<Confirm2faResponse> {
    const { backupCodes } = await this.authService.confirm2fa(user.id, dto);
    return {
      message:
        '2FA enabled successfully. Store these one-time backup codes — they will not be shown again.',
      backupCodes,
    };
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: RegenerateBackupCodesResponse })
  @ApiBadRequestResponse({ description: '2FA not enabled' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Password confirmation required' })
  async regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RegenerateBackupCodesResponse> {
    const { backupCodes } = await this.authService.regenerateBackupCodes(
      user.id,
    );
    return { backupCodes };
  }

  @Post('2fa/disable')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Password confirmation required' })
  async disable2fa(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.disable2fa(user.id);
  }

  // ─── Legacy OTP/TOTP (kept for backward compatibility) ────────────────────

  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: VerifyOtpResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpDto,
  ): Promise<VerifyOtpResponse> {
    return this.authService.verifyOtp(dto);
  }

  @Post('verify-totp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid TOTP code' })
  async verifyTotp(
    @Body(new ZodValidationPipe(VerifyTotpSchema)) dto: VerifyTotpDto,
  ): Promise<TokenResponse> {
    const { accessToken, refreshToken, expiresIn } =
      await this.authService.verifyTotp(dto);
    return { accessToken, refreshToken, expiresIn };
  }
}
