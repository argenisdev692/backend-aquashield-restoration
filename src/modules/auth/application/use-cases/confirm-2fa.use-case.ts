import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { ITotpPort } from '../../domain/ports/outbound/totp.port';
import { TOTP_PORT } from '../../domain/ports/outbound/totp.port';
import type { IBackupCodeRepository } from '../../domain/repositories/backup-code.repository.interface';
import { BACKUP_CODE_REPOSITORY } from '../../domain/repositories/backup-code.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import { TwoFactorEnabledEvent } from '../../domain/events/auth-events';
import { BackupCode } from '../../domain/value-objects/backup-code.vo';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import type { Confirm2faInput } from '../dtos/confirm-2fa.dto';

/** Number of recovery codes generated when 2FA is enabled. */
export const BACKUP_CODE_COUNT = 8;

export interface Confirm2faResult {
  /**
   * Plaintext backup codes shown to the user EXACTLY ONCE. Only bcrypt hashes
   * are persisted. Lost codes must be regenerated via the dedicated endpoint.
   */
  backupCodes: string[];
}

@Injectable()
export class Confirm2faUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(TOTP_PORT)
    private readonly totp: ITotpPort,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodeRepo: IBackupCodeRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(Confirm2faUseCase.name);
  }

  async execute(
    userId: string,
    dto: Confirm2faInput,
  ): Promise<Confirm2faResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Confirm 2FA', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('2FA setup not initiated');
    }

    const valid = await this.totp.verify({
      secret: user.totpSecret,
      token: dto.code,
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate fresh backup codes; the plaintext escapes the boundary once
    // (the response) and only bcrypt hashes survive in the DB.
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      BackupCode.generate(),
    );
    const hashes = await Promise.all(
      codes.map((c) => this.passwordHasher.hash(BackupCode.normalize(c.plain))),
    );

    await this.tx.runInTx(async () => {
      await this.userRepo.enableTotp(userId);
      await this.backupCodeRepo.replaceAllForUser(userId, hashes);
      await this.audit.log(
        {
          action: 'auth.2fa_enabled',
          resourceType: 'USER',
          resourceId: userId,
          metadata: { backupCodesIssued: BACKUP_CODE_COUNT },
        },
        { strict: true },
      );
    });

    this.eventEmitter.emit(
      'auth.2fa_enabled',
      new TwoFactorEnabledEvent(userId),
    );

    this.logger.info('2FA enabled with backup codes', { traceId, userId });
    return { backupCodes: codes.map((c) => c.plain) };
  }
}
