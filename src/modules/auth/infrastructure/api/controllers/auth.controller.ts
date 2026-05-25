import {
  Controller,
  Post,
  Get,
  Delete,
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
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { FreshPasswordGuard } from '../guards/fresh-password.guard';

import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { LogoutAllSessionsUseCase } from '../../../application/use-cases/logout-all-sessions.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from '../../../application/use-cases/register.use-case';
import { GetMeUseCase } from '../../../application/use-cases/get-me.use-case';
import { UpdateProfileUseCase } from '../../../application/use-cases/update-profile.use-case';
import { UploadProfilePhotoUseCase } from '../../../application/use-cases/upload-profile-photo.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-cases/request-password-reset.use-case';
import { ValidateResetTokenUseCase } from '../../../application/use-cases/validate-reset-token.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../../../application/use-cases/verify-email.use-case';
import { ResendVerificationEmailUseCase } from '../../../application/use-cases/resend-verification-email.use-case';
import { GetPasswordConfirmationStatusUseCase } from '../../../application/use-cases/get-password-confirmation-status.use-case';
import { ConfirmPasswordUseCase } from '../../../application/use-cases/confirm-password.use-case';
import { VerifyTwoFactorChallengeUseCase } from '../../../application/use-cases/verify-two-factor-challenge.use-case';
import { GoogleAuthUseCase } from '../../../application/use-cases/google-auth.use-case';
import { Enable2faUseCase } from '../../../application/use-cases/enable-2fa.use-case';
import { formatPhonePretty } from '../../../../../shared/phone/phone.util';
import { Confirm2faUseCase } from '../../../application/use-cases/confirm-2fa.use-case';
import { Disable2faUseCase } from '../../../application/use-cases/disable-2fa.use-case';
import { Regenerate2faBackupCodesUseCase } from '../../../application/use-cases/regenerate-2fa-backup-codes.use-case';
import { ListSessionsUseCase } from '../../../application/use-cases/list-sessions.use-case';
import { RevokeSessionUseCase } from '../../../application/use-cases/revoke-session.use-case';
import { ListTrustedDevicesUseCase } from '../../../application/use-cases/list-trusted-devices.use-case';
import { RevokeTrustedDeviceUseCase } from '../../../application/use-cases/revoke-trusted-device.use-case';
import { VerifyOtpUseCase } from '../../../application/use-cases/verify-otp.use-case';
import { VerifyTotpUseCase } from '../../../application/use-cases/verify-totp.use-case';
import { ChangeExpiredPasswordUseCase } from '../../../application/use-cases/change-expired-password.use-case';

import { LoginDto, LoginSchema } from '../../../application/dtos/login.dto';
import { LogoutDto, LogoutSchema } from '../../../application/dtos/logout.dto';
import {
  RefreshTokenDto,
  RefreshTokenSchema,
} from '../../../application/dtos/refresh-token.dto';
import {
  RegisterDto,
  RegisterSchema,
} from '../../../application/dtos/register.dto';
import {
  UpdateProfileDto,
  UpdateProfileSchema,
} from '../../../application/dtos/update-profile.dto';
import {
  RequestPasswordResetDto,
  RequestPasswordResetSchema,
} from '../../../application/dtos/request-password-reset.dto';
import {
  ResetPasswordDto,
  ResetPasswordSchema,
} from '../../../application/dtos/reset-password.dto';
import {
  ConfirmPasswordDto,
  ConfirmPasswordSchema,
} from '../../../application/dtos/confirm-password.dto';
import {
  VerifyTwoFactorChallengeDto,
  VerifyTwoFactorChallengeSchema,
} from '../../../application/dtos/verify-two-factor-challenge.dto';
import {
  GoogleAuthDto,
  GoogleAuthSchema,
} from '../../../application/dtos/google-auth.dto';
import {
  VerifyOtpDto,
  VerifyOtpSchema,
} from '../../../application/dtos/verify-otp.dto';
import {
  Confirm2faDto,
  Confirm2faSchema,
} from '../../../application/dtos/confirm-2fa.dto';
import {
  VerifyTotpDto,
  VerifyTotpSchema,
} from '../../../application/dtos/verify-totp.dto';
import {
  ChangeExpiredPasswordDto,
  ChangeExpiredPasswordSchema,
} from '../../../application/dtos/change-expired-password.dto';

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
} from '../presenters/auth.response';

/** Trusted-device cookie name. Read in cls.setup.ts and on /logout to clear. */
const TRUSTED_DEVICE_COOKIE = 'td';

/**
 * Auth controller — covers all authentication, registration, email-verification,
 * password-reset, 2FA, profile and Google-auth endpoints.
 *
 * Public endpoints (no guard): login, register, forgot-password, reset-password,
 *   email/verify, two-factor-challenge, google-auth, verify-otp, verify-totp, refresh.
 * Authenticated endpoints: me, update-profile, email/verification-notification,
 *   user/confirm-password, logout, logout-all, 2fa/* .
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly uploadProfilePhotoUseCase: UploadProfilePhotoUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly validateResetTokenUseCase: ValidateResetTokenUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationEmailUseCase: ResendVerificationEmailUseCase,
    private readonly getPasswordConfirmationStatusUseCase: GetPasswordConfirmationStatusUseCase,
    private readonly confirmPasswordUseCase: ConfirmPasswordUseCase,
    private readonly verifyTwoFactorChallengeUseCase: VerifyTwoFactorChallengeUseCase,
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly verifyTotpUseCase: VerifyTotpUseCase,
    private readonly enable2faUseCase: Enable2faUseCase,
    private readonly confirm2faUseCase: Confirm2faUseCase,
    private readonly disable2faUseCase: Disable2faUseCase,
    private readonly regenerate2faBackupCodesUseCase: Regenerate2faBackupCodesUseCase,
    private readonly changeExpiredPasswordUseCase: ChangeExpiredPasswordUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly listTrustedDevicesUseCase: ListTrustedDevicesUseCase,
    private readonly revokeTrustedDeviceUseCase: RevokeTrustedDeviceUseCase,
  ) {}

  // ─── Authentication ────────────────────────────────────────────────────────

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ): Promise<LoginResponse> {
    return this.loginUseCase.execute(dto);
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
    return this.changeExpiredPasswordUseCase.execute(dto);
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
    await this.logoutUseCase.execute(user.id, dto);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.logoutAllSessionsUseCase.execute(user.id);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or revoked refresh token' })
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ): Promise<TokenResponse> {
    return this.refreshTokenUseCase.execute(dto);
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: RegisterResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ): Promise<RegisterResponse> {
    return this.registerUseCase.execute(dto);
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const profile = await this.getMeUseCase.execute(user.id);
    return {
      id: profile.id,
      name: profile.name,
      lastName: profile.lastName,
      username: profile.username,
      email: profile.email,
      phone: formatPhonePretty(profile.phone),
      dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
      address: profile.address,
      address2: profile.address2,
      zipCode: profile.zipCode,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      gender: profile.gender,
      profilePhotoPath: profile.profilePhotoPath,
      emailVerified: profile.emailVerifiedAt !== null,
      emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
      totpEnabled: profile.totpEnabled,
      passwordConfirmed: profile.passwordConfirmedAt !== null,
      hasGoogleAuth: profile.googleId !== null,
      roles: profile.roles,
      permissions: profile.permissions,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  @Post('update-profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<MessageResponse> {
    await this.updateProfileUseCase.execute(user.id, dto);
    return { message: 'Profile updated successfully' };
  }

  @Post('profile-photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ profilePhoto: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @SkipCache()
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Invalid file' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async uploadProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ): Promise<MessageResponse> {
    await this.uploadProfilePhotoUseCase.execute(user.id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    return { message: 'Profile photo updated successfully' };
  }

  // ─── Password Reset ────────────────────────────────────────────────────────

  @Get('forgot-password')
  @ApiOkResponse({ type: MessageResponse })
  forgotPasswordInfo(): MessageResponse {
    return {
      message:
        'POST to this endpoint with { email } to receive a 6-digit reset code by email. ' +
        'Then POST to /auth/reset-password with { resetToken, code, email, password, passwordConfirmation }.',
    };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: ForgotPasswordResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async forgotPassword(
    @Body(new ZodValidationPipe(RequestPasswordResetSchema))
    dto: RequestPasswordResetDto,
  ): Promise<ForgotPasswordResponse> {
    return this.requestPasswordResetUseCase.execute(dto);
  }

  @Get('reset-password/:token')
  @ApiOkResponse({ type: ResetTokenValidationResponse })
  @ApiParam({
    name: 'token',
    type: String,
    description: 'Raw reset token from email link',
  })
  async validateResetToken(
    @Param('token') token: string,
  ): Promise<ResetTokenValidationResponse> {
    return this.validateResetTokenUseCase.execute(token);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<MessageResponse> {
    await this.resetPasswordUseCase.execute(dto);
    return { message: 'Password has been reset successfully. Please log in.' };
  }

  // ─── Email Verification ────────────────────────────────────────────────────

  @Get('email/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: EmailVerificationStatusResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async emailVerificationStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmailVerificationStatusResponse> {
    const profile = await this.getMeUseCase.execute(user.id);
    return {
      verified: profile.emailVerifiedAt !== null,
      verifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
    };
  }

  @Get('email/verify/:id/:hash')
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Invalid verification link' })
  @ApiUnauthorizedResponse({ description: 'Invalid or tampered verification hash' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'User UUID',
  })
  @ApiParam({
    name: 'hash',
    type: String,
    description: 'HMAC-SHA256 verification hash',
  })
  async verifyEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hash') hash: string,
  ): Promise<MessageResponse> {
    await this.verifyEmailUseCase.execute(id, hash);
    return { message: 'Email address verified successfully.' };
  }

  @Post('email/verification-notification')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Email already verified' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.resendVerificationEmailUseCase.execute(user.id);
    return { message: 'Verification email has been sent.' };
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
    const status = await this.getPasswordConfirmationStatusUseCase.execute(
      user.id,
    );
    return {
      confirmed: status.confirmed,
      confirmedAt: status.confirmedAt?.toISOString() ?? null,
    };
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
    await this.confirmPasswordUseCase.execute(user.id, dto);
    return { message: 'Password confirmed.' };
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
    const result = await this.verifyTwoFactorChallengeUseCase.execute(dto);
    // Set the trusted-device cookie when the use case minted one. The raw
    // token never lives in the JSON body shown to JS callers — only the
    // httpOnly cookie carries it. (`trustedDeviceToken` is stripped below.)
    if (result.trustedDeviceToken && result.trustedDeviceTtlMs) {
      res.cookie(TRUSTED_DEVICE_COOKIE, result.trustedDeviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: result.trustedDeviceTtlMs,
        path: '/',
      });
    }
    const { trustedDeviceToken: _t, trustedDeviceTtlMs: _ttl, ...body } = result;
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
    const sessions = await this.listSessionsUseCase.execute(user.id);
    return { sessions };
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
    await this.revokeSessionUseCase.execute(user.id, id);
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
    const trustedDevices = await this.listTrustedDevicesUseCase.execute(user.id);
    return { trustedDevices };
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
    await this.revokeTrustedDeviceUseCase.execute(user.id, id);
    // Best-effort: if the revoked device is the caller's current device,
    // clear the cookie. We don't know the cookie's hash here, so always
    // clear — the worst case is the user re-trusts on next 2FA prompt.
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
    return this.googleAuthUseCase.execute(dto);
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
    return this.enable2faUseCase.execute(user.id, user.email ?? '');
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
    const { backupCodes } = await this.confirm2faUseCase.execute(user.id, dto);
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
    const { backupCodes } = await this.regenerate2faBackupCodesUseCase.execute(
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
    await this.disable2faUseCase.execute(user.id);
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
    return this.verifyOtpUseCase.execute(dto);
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
      await this.verifyTotpUseCase.execute(dto);
    return { accessToken, refreshToken, expiresIn };
  }
}
