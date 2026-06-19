import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { TOTP_SERVICE, type ITotpService } from '../../domain/ports/totp.port';
import {
  TwoFactorInvalidException,
  TwoFactorNotEnabledException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import {
  BackupCode,
  BACKUP_CODES_PER_USER,
} from '../../domain/entities/backup-code.entity';
import { TwoFactorEnabledEvent } from '../../domain/events/two-factor-enabled.event';
import { generateBackupCodes } from '../utils/backup-code.util';
import type { EnableTotpInput } from '../dto/enable-totp.dto';

export interface EnableTotpResult {
  /** The 8 backup codes — shown ONCE in plaintext; only bcrypt hashes persist. */
  backupCodes: string[];
}

/**
 * Verify a TOTP code against the candidate secret stored by `setup-totp`,
 * mark 2FA enabled, generate 8 single-use backup codes, persist their
 * bcrypt hashes, and emit `TwoFactorEnabledEvent`.
 *
 * The plaintext backup codes are returned ONLY here — the user must store
 * them right away because we never display them again.
 */
@Injectable()
export class EnableTotpUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: IBackupCodeRepository,
    @Inject(TOTP_SERVICE) private readonly totp: ITotpService,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(EnableTotpUseCase.name);
  }

  async execute(args: {
    userId: string;
    input: EnableTotpInput;
  }): Promise<EnableTotpResult> {
    // Pre-flight (outside tx) — verify the code and generate the codes first.
    const account = await this.accounts.findById(args.userId);
    if (!account) throw new UserAccountNotFoundException();
    if (account.totpEnabled) throw new TwoFactorNotEnabledException();
    if (!account.totpSecret) throw new TwoFactorInvalidException();

    if (!this.totp.verify(account.totpSecret.reveal(), args.input.code)) {
      throw new TwoFactorInvalidException();
    }

    const plain = generateBackupCodes(BACKUP_CODES_PER_USER, 10);
    const hashes = await Promise.all(plain.map((c) => this.hasher.hash(c)));

    await this.commit(args.userId, hashes);

    this.logger.info('TOTP enabled', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
    });

    return { backupCodes: plain };
  }

  @Transactional()
  private async commit(userId: string, hashes: string[]): Promise<void> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();

    // Re-check inside the tx in case of a concurrent enable/disable.
    if (!account.totpSecret) throw new TwoFactorInvalidException();

    account.enableTwoFactor(hashes.length);
    await this.accounts.save(account);

    await this.backupCodes.replaceAll(
      userId,
      hashes.map((codeHash) => BackupCode.create({ userId, codeHash })),
    );

    await this.audit.log(
      {
        action: 'auth.two_factor.enabled',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: { ipAddress: ip, backupCodesIssued: hashes.length },
      },
      { strict: true },
    );

    for (const event of account.domainEvents) {
      if (event instanceof TwoFactorEnabledEvent) {
        this.events.emit(TwoFactorEnabledEvent.name, event);
      }
    }
    account.clearDomainEvents();
  }
}
