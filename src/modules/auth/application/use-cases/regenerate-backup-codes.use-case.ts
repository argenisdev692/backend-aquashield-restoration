import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  PASSWORD_HASHER_PORT,
  type IPasswordHasherPort,
} from '../../../../shared/security/password-hasher.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  BACKUP_CODE_REPOSITORY,
  type IBackupCodeRepository,
} from '../../domain/ports/backup-code.repository.port';
import {
  TwoFactorNotEnabledException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import {
  BackupCode,
  BACKUP_CODES_PER_USER,
} from '../../domain/entities/backup-code.entity';
import { generateBackupCodes } from '../utils/backup-code.util';

/**
 * Replace every backup code with a fresh set (8 codes × 10 chars).
 *
 * Gated behind `FreshPasswordGuard` — regenerating is as sensitive as
 * disabling 2FA. The new plaintext codes are returned ONCE.
 */
@Injectable()
export class RegenerateBackupCodesUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: IBackupCodeRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RegenerateBackupCodesUseCase.name);
  }

  async execute(userId: string): Promise<{ backupCodes: string[] }> {
    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();
    if (!account.totpEnabled) throw new TwoFactorNotEnabledException();

    const plain = generateBackupCodes(BACKUP_CODES_PER_USER, 10);
    const hashes = await Promise.all(plain.map((c) => this.hasher.hash(c)));

    await this.persist(userId, hashes);

    this.logger.info('Backup codes regenerated', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
    });

    return { backupCodes: plain };
  }

  @Transactional()
  private async persist(userId: string, hashes: string[]): Promise<void> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    await this.backupCodes.replaceAll(
      userId,
      hashes.map((codeHash) => BackupCode.create({ userId, codeHash })),
    );
    await this.audit.log(
      {
        action: 'auth.backup_codes.regenerated',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: { ipAddress: ip, count: hashes.length },
      },
      { strict: true },
    );
  }
}
