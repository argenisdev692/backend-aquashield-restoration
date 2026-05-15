import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { LogoutInput } from '../dtos/logout.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(LogoutUseCase.name);
  }

  async execute(userId: string, dto?: LogoutInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Logout', { traceId, userId });

    if (dto?.refreshToken) {
      const session = await this.sessionRepo.findByRefreshToken(
        dto.refreshToken,
      );
      if (session && session.userId === userId) {
        await this.sessionRepo.revokeById(session.id);
      }
    }

    await this.audit.log({
      action: 'auth.logout',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('User logged out', { traceId, userId });
  }
}
