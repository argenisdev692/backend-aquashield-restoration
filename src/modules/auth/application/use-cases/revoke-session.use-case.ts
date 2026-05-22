import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RevokeSessionUseCase.name);
  }

  async execute(userId: string, sessionId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const ok = await this.sessionRepo.revokeByIdForUser(sessionId, userId);
    if (!ok) {
      throw new NotFoundException('Session not found');
    }

    await this.audit.log({
      action: 'auth.session_revoked',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { sessionId },
    });
    this.logger.info('Session revoked', { traceId, userId, sessionId });
  }
}
