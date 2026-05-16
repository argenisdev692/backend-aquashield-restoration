import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { VerifyOtpUseCase } from '../../../application/use-cases/verify-otp.use-case';
import { VerifyTotpUseCase } from '../../../application/use-cases/verify-totp.use-case';
import { Enable2faUseCase } from '../../../application/use-cases/enable-2fa.use-case';
import { Confirm2faUseCase } from '../../../application/use-cases/confirm-2fa.use-case';
import { Disable2faUseCase } from '../../../application/use-cases/disable-2fa.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { LogoutAllSessionsUseCase } from '../../../application/use-cases/logout-all-sessions.use-case';
import { LoginDto, LoginSchema } from '../../../application/dtos/login.dto';
import {
  VerifyOtpDto,
  VerifyOtpSchema,
} from '../../../application/dtos/verify-otp.dto';
import {
  Confirm2faDto,
  Confirm2faSchema,
} from '../../../application/dtos/confirm-2fa.dto';
import {
  RefreshTokenDto,
  RefreshTokenSchema,
} from '../../../application/dtos/refresh-token.dto';
import { LogoutDto, LogoutSchema } from '../../../application/dtos/logout.dto';
import {
  VerifyTotpDto,
  VerifyTotpSchema,
} from '../../../application/dtos/verify-totp.dto';
import {
  LoginResponse,
  TokenResponse,
  VerifyOtpResponse,
  TwoFactorSetupResponse,
  MessageResponse,
} from '../presenters/auth.response';

/**
 * Authenticated mutation endpoints chain `JwtAuthGuard` + `CaslGuard` per
 * project rule. The 2FA / logout endpoints act on the caller's OWN user
 * (ownership is implicit through `@CurrentUser`), so they do NOT declare
 * `@CheckAbilities()` — `CaslGuard` short-circuits to `true` when no rules
 * are declared, while still being present in the chain for future
 * cross-cutting policies. The public endpoints (`/login`, `/verify-otp`,
 * `/verify-totp`, `/refresh`) are intentionally NOT guarded — they are the
 * authentication gateway itself.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly verifyTotpUseCase: VerifyTotpUseCase,
    private readonly enable2faUseCase: Enable2faUseCase,
    private readonly confirm2faUseCase: Confirm2faUseCase,
    private readonly disable2faUseCase: Disable2faUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
  ) {}

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

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto,
  ): Promise<void> {
    await this.logoutUseCase.execute(user.id, dto);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.logoutAllSessionsUseCase.execute(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: TwoFactorSetupResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponse> {
    return this.enable2faUseCase.execute(user.id, user.email ?? '');
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Invalid TOTP code' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async confirm2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(Confirm2faSchema)) dto: Confirm2faDto,
  ): Promise<MessageResponse> {
    await this.confirm2faUseCase.execute(user.id, dto);
    return { message: '2FA enabled' };
  }

  @Post('2fa/disable')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async disable2fa(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.disable2faUseCase.execute(user.id);
  }
}
