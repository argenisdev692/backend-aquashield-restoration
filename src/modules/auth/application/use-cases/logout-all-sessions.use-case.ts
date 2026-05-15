import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

@Injectable()
export class LogoutAllSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(LogoutAllSessionsUseCase.name);
  }

  async execute(userId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Logout all sessions', { traceId, userId });

    await this.sessionRepo.revokeAllForUser(userId);

    await this.audit.log({
      action: 'auth.logout_all',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('All sessions revoked', { traceId, userId });
  }
}
