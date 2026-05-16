import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { EmailVerifiedEvent } from '../../domain/events/auth-events';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(VerifyEmailUseCase.name);
  }

  async execute(userId: string, hash: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('VerifyEmail start', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt !== null) {
      this.logger.info('Email already verified', { traceId, userId });
      return;
    }

    const expectedHash = this.computeEmailHash(userId, user.email);
    if (!this.safeEqual(expectedHash, hash)) {
      throw new BadRequestException('Invalid verification link');
    }

    await this.userRepo.setEmailVerified(userId);

    this.eventEmitter.emit('auth.email_verified', new EmailVerifiedEvent(userId));

    await this.audit.log({
      action: 'auth.email_verified',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('Email verified', { traceId, userId });
  }

  private computeEmailHash(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHmac('sha256', secret)
      .update(`${userId}:${email}`)
      .digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}
