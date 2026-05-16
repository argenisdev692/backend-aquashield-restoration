import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IOtpRepository } from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import { OtpRequestedEvent } from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { LoginInput } from '../dtos/login.dto';

export interface LoginResult {
  requiresOtp: boolean;
  requiresTotp: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(LoginUseCase.name);
  }

  async execute(dto: LoginInput): Promise<LoginResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Login attempt', { traceId, email: dto.email });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordHasher.compare(
      dto.password,
      user.password,
    );
    if (!valid) {
      await this.audit.log({
        action: 'auth.login_failed',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 1: Email OTP required
    const otp = OtpCode.generate(5);
    await this.otpRepo.save({ userId: user.id, code: otp, type: 'login' });
    await this.emailPort.sendOtp({
      to: dto.email,
      code: otp.code,
      type: 'login',
    });

    this.eventEmitter.emit(
      'auth.otp_requested',
      new OtpRequestedEvent(user.id, 'login'),
    );

    await this.audit.log({
      action: 'auth.otp_requested',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('OTP sent for login', { traceId, userId: user.id });

    return {
      requiresOtp: true,
      requiresTotp: user.totpEnabled,
    };
  }
}
