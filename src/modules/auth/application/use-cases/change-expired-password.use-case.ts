import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordHistoryRepository } from '../../domain/repositories/password-history.repository.interface';
import { PASSWORD_HISTORY_REPOSITORY } from '../../domain/repositories/password-history.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { ITokenServicePort } from '../../domain/ports/outbound/token-service.port';
import { TOKEN_SERVICE_PORT } from '../../domain/ports/outbound/token-service.port';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import {
  AuthTokenIssuer,
  type IssuedTokens,
} from '../services/auth-token-issuer.service';
import { PasswordChangedEvent } from '../../domain/events/auth-events';
import type { IBreachedPasswordPort } from '../../../../shared/security/breached-password.port';
import {
  BREACHED_PASSWORD_PORT,
  BREACHED_PASSWORD_MESSAGE,
} from '../../../../shared/security/breached-password.port';
import type { ChangeExpiredPasswordInput } from '../dtos/change-expired-password.dto';

/** Number of recent hashes to check for reuse. */
const PASSWORD_HISTORY_CHECK_LIMIT = 5;

/** Number of recent hashes to retain in the history table. */
const PASSWORD_HISTORY_KEEP = 10;

@Injectable()
export class ChangeExpiredPasswordUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY)
    private readonly historyRepo: IPasswordHistoryRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(BREACHED_PASSWORD_PORT)
    private readonly breachedPwd: IBreachedPasswordPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenServicePort,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ChangeExpiredPasswordUseCase.name);
  }

  async execute(dto: ChangeExpiredPasswordInput): Promise<IssuedTokens> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Change expired password attempt', { traceId });

    const userId = await this.tokenService.verifyPasswordChangeToken(
      dto.passwordChangeToken,
    );
    if (!userId) {
      throw new UnauthorizedException(
        'Invalid or expired password change token',
      );
    }

    const user = await this.userRepo.findById(userId);
    const passwordExpired =
      user?.passwordExpiresAt != null && user.passwordExpiresAt <= new Date();
    if (!user || (!user.mustChangePassword && !passwordExpired)) {
      throw new UnauthorizedException(
        'Password change is not required for this account',
      );
    }

    const recentHashes = await this.historyRepo.getRecent(
      userId,
      PASSWORD_HISTORY_CHECK_LIMIT,
    );
    for (const hash of recentHashes) {
      const isReused = await this.passwordHasher.compare(dto.newPassword, hash);
      if (isReused) {
        throw new BadRequestException(
          `New password must differ from your last ${PASSWORD_HISTORY_CHECK_LIMIT} passwords`,
        );
      }
    }

    if (await this.breachedPwd.isBreached(dto.newPassword)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const hashedPassword = await this.passwordHasher.hash(dto.newPassword);
    const now = new Date();
    const passwordExpiresAt = this.computeExpiresAt(now);

    const tokens = await this.tx.runInTx(async () => {
      await this.historyRepo.addEntry(userId, hashedPassword);
      await this.historyRepo.pruneOldest(userId, PASSWORD_HISTORY_KEEP);
      await this.userRepo.updatePasswordWithStatus(
        userId,
        hashedPassword,
        now,
        passwordExpiresAt,
      );
      await this.sessionRepo.revokeAllForUser(userId);
      return this.tokenIssuer.issue(user);
    });

    this.eventEmitter.emit(
      'auth.password_changed',
      new PasswordChangedEvent(userId),
    );

    await this.audit.log({
      action: 'auth.password_changed',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('Expired password changed successfully', {
      traceId,
      userId,
    });
    return tokens;
  }

  private computeExpiresAt(from: Date): Date | null {
    const days = this.config.get<number>('PASSWORD_EXPIRES_DAYS', 90);
    if (days === 0) return null;
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
