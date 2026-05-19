import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { SetupToken } from '../../domain/value-objects/setup-token.vo';
import type { RequestPasswordChangeInput } from '../dtos/request-password-change.dto';

const CHANGE_TOKEN_TTL_MS = 72 * 60 * 60 * 1_000;

@Injectable()
export class RequestPasswordChangeUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SETUP_REPOSITORY)
    private readonly setupRepo: IPasswordSetupRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(dto: RequestPasswordChangeInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RequestPasswordChangeUseCase start', {
      traceId,
      email: dto.email,
    });

    const user = await this.userRepo.findByEmail(dto.email);

    if (!user) {
      this.logger.info('Password change — email not found (silent)', {
        traceId,
      });
      return;
    }

    await this.setupRepo.invalidateAllForUser(user.id.value, 'change');

    const token = SetupToken.generate();
    const expiresAt = new Date(Date.now() + CHANGE_TOKEN_TTL_MS);
    await this.setupRepo.save({
      userId: user.id.value,
      token,
      type: 'change',
      expiresAt,
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const setupLink = `${appUrl}/users/change-password?token=${token.raw}`;
    await this.emailPort.sendPasswordSetupLink({
      to: dto.email,
      setupLink,
      name: user.name,
      type: 'change',
    });

    await this.audit.log({
      action: 'users.password_change_requested',
      resourceType: 'USER',
      resourceId: user.id.value,
    });

    this.logger.info('RequestPasswordChangeUseCase end', {
      traceId,
      userId: user.id.value,
    });
  }
}
