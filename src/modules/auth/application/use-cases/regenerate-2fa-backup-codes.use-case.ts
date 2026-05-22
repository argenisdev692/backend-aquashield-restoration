import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IBackupCodeRepository } from '../../domain/repositories/backup-code.repository.interface';
import { BACKUP_CODE_REPOSITORY } from '../../domain/repositories/backup-code.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import { BackupCode } from '../../domain/value-objects/backup-code.vo';
import { BACKUP_CODE_COUNT } from './confirm-2fa.use-case';

export interface Regenerate2faBackupCodesResult {
  backupCodes: string[];
}

/**
 * Generates a brand-new set of backup codes, invalidating every previous one.
 * Caller must hold a fresh password confirmation (enforced by FreshPasswordGuard
 * on the controller) and have 2FA already enabled.
 */
@Injectable()
export class Regenerate2faBackupCodesUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodeRepo: IBackupCodeRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(Regenerate2faBackupCodesUseCase.name);
  }

  async execute(userId: string): Promise<Regenerate2faBackupCodesResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Regenerate 2FA backup codes', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user || !user.totpEnabled) {
      throw new BadRequestException('2FA must be enabled before regenerating backup codes');
    }

    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      BackupCode.generate(),
    );
    const hashes = await Promise.all(
      codes.map((c) => this.passwordHasher.hash(BackupCode.normalize(c.plain))),
    );

    await this.tx.runInTx(async () => {
      await this.backupCodeRepo.replaceAllForUser(userId, hashes);
      await this.audit.log(
        {
          action: 'auth.2fa_backup_codes_regenerated',
          resourceType: 'USER',
          resourceId: userId,
          metadata: { count: BACKUP_CODE_COUNT },
        },
        { strict: true },
      );
    });

    this.logger.info('2FA backup codes regenerated', { traceId, userId });
    return { backupCodes: codes.map((c) => c.plain) };
  }
}
