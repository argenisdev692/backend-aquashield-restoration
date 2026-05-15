import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { VerifyOtpUseCase } from '../../../application/use-cases/verify-otp.use-case';
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
import {
  LogoutDto,
  LogoutSchema,
} from '../../../application/dtos/logout.dto';
import {
  LoginResponse,
  TokenResponse,
  TwoFactorSetupResponse,
  MessageResponse,
} from '../presenters/auth.response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly enable2faUseCase: Enable2faUseCase,
    private readonly confirm2faUseCase: Confirm2faUseCase,
    private readonly disable2faUseCase: Disable2faUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
  ) {}

  @Post('login')
  @ApiCreatedResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ): Promise<LoginResponse> {
    return this.loginUseCase.execute(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpDto,
  ): Promise<TokenResponse> {
    const result = await this.verifyOtpUseCase.execute(dto);
    if (result.requiresTotp) {
      return {
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
      } as TokenResponse;
    }
    return result as TokenResponse;
  }

  @Post('verify-totp')
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid TOTP code' })
  async verifyTotp(
    @Body() body: { email: string; code: string },
  ): Promise<TokenResponse> {
    const result = await this.verifyOtpUseCase.verifyTotpAndIssue(
      body.email,
      body.code,
    );
    return result as TokenResponse;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or revoked refresh token' })
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ): Promise<TokenResponse> {
    return this.refreshTokenUseCase.execute(dto);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto,
  ): Promise<MessageResponse> {
    await this.logoutUseCase.execute(user.id, dto);
    return { message: 'Logged out' };
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.logoutAllSessionsUseCase.execute(user.id);
    return { message: 'All sessions revoked' };
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: TwoFactorSetupResponse })
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponse> {
    return this.enable2faUseCase.execute(user.id, user.email ?? '');
  }

  @Post('2fa/confirm')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Invalid TOTP code' })
  async confirm2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(Confirm2faSchema)) dto: Confirm2faDto,
  ): Promise<MessageResponse> {
    await this.confirm2faUseCase.execute(user.id, dto);
    return { message: '2FA enabled' };
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponse })
  async disable2fa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.disable2faUseCase.execute(user.id);
    return { message: '2FA disabled' };
  }
}
