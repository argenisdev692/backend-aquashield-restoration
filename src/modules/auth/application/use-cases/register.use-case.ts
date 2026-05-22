import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordHistoryRepository } from '../../domain/repositories/password-history.repository.interface';
import { PASSWORD_HISTORY_REPOSITORY } from '../../domain/repositories/password-history.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { UserRegisteredEvent } from '../../domain/events/auth-events';
import type { IBreachedPasswordPort } from '../../../../shared/security/breached-password.port';
import {
  BREACHED_PASSWORD_PORT,
  BREACHED_PASSWORD_MESSAGE,
} from '../../../../shared/security/breached-password.port';
import { maskEmail } from '../../../../shared/utils/mask.util';
import type { RegisterInput } from '../dtos/register.dto';

export interface RegisterResult {
  id: string;
  email: string;
  message: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY)
    private readonly historyRepo: IPasswordHistoryRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(BREACHED_PASSWORD_PORT)
    private readonly breachedPwd: IBreachedPasswordPort,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RegisterUseCase.name);
  }

  async execute(dto: RegisterInput): Promise<RegisterResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Register attempt', {
      traceId,
      email: maskEmail(dto.email),
    });

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email address is already registered');
    }

    if (await this.breachedPwd.isBreached(dto.password)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const user = await this.userRepo.create({
      name: dto.name,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      hashedPassword,
      termsAndConditions: dto.termsAndConditions,
    });

    await this.historyRepo.addEntry(user.id, hashedPassword);

    const verificationLink = this.buildVerificationLink(user.id, dto.email);
    await this.emailPort.sendVerificationLink({
      to: dto.email,
      verificationLink,
      name: dto.name,
    });
    await this.emailPort.sendWelcomeEmail({ to: dto.email, name: dto.name });

    this.eventEmitter.emit(
      'auth.registered',
      new UserRegisteredEvent(user.id, dto.email),
    );

    await this.audit.log({
      action: 'auth.registered',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('User registered', { traceId, userId: user.id });
    return {
      id: user.id,
      email: user.email,
      message: 'Registration successful. Please verify your email address.',
    };
  }

  buildVerificationLink(userId: string, email: string): string {
    const hash = this.computeEmailHash(userId, email);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    return `${appUrl}/api/v1/auth/email/verify/${userId}/${hash}`;
  }

  computeEmailHash(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHmac('sha256', secret)
      .update(`${userId}:${email}`)
      .digest('hex');
  }
}
