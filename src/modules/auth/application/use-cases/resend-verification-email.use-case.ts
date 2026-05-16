import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

@Injectable()
export class ResendVerificationEmailUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendVerificationEmailUseCase.name);
  }

  async execute(userId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ResendVerificationEmail start', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user) return;

    if (user.emailVerifiedAt !== null) {
      throw new BadRequestException('Email address is already verified');
    }

    const verificationLink = this.buildVerificationLink(user.id, user.email);
    await this.emailPort.sendVerificationLink({
      to: user.email,
      verificationLink,
      name: user.email,
    });

    await this.audit.log({
      action: 'auth.verification_resent',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('Verification email resent', { traceId, userId });
  }

  private buildVerificationLink(userId: string, email: string): string {
    const hash = this.computeEmailHash(userId, email);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    return `${appUrl}/api/v1/auth/email/verify/${userId}/${hash}`;
  }

  private computeEmailHash(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHmac('sha256', secret)
      .update(`${userId}:${email}`)
      .digest('hex');
  }
}
