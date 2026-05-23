import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import type { RefreshTokenInput } from '../dtos/refresh-token.dto';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RefreshTokenUseCase.name);
  }

  async execute(dto: RefreshTokenInput): Promise<RefreshTokenResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Refresh token attempt', { traceId });

    const session = await this.sessionRepo.findByRefreshToken(dto.refreshToken);
    if (!session || !session.isActive) {
      this.logger.warn('Refresh token rejected', {
        traceId,
        reason: session ? 'inactive' : 'not_found',
      });
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      this.logger.warn('Refresh token user missing', {
        traceId,
        sessionId: session.id,
      });
      throw new UnauthorizedException('User not found');
    }

    // Rotation is atomic: revoke + issue + audit happen inside a single DB
    // transaction. If issuing or auditing fails, the revoke is rolled back
    // so the user is never left without any valid session or trace.
    const tokens = await this.tx.runInTx(async () => {
      await this.sessionRepo.revokeById(session.id);
      const issued = await this.tokenIssuer.issue(user);
      await this.audit.log(
        {
          action: 'auth.token_refreshed',
          resourceType: 'USER',
          resourceId: user.id,
        },
        { strict: true },
      );
      return issued;
    });

    this.logger.info('Token refreshed', { traceId, userId: user.id });
    return tokens;
  }
}
