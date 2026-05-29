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
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  BACKUP_CODE_REPOSITORY,
  type IBackupCodeRepository,
} from '../../domain/ports/backup-code.repository.port';
import {
  TRUSTED_DEVICE_REPOSITORY,
  type ITrustedDeviceRepository,
} from '../../domain/ports/trusted-device.repository.port';
import { TwoFactorDisabledEvent } from '../../domain/events/two-factor-enabled.event';
import { UserAccountNotFoundException } from '../../domain/exceptions/auth-domain.exception';

/**
 * Turn 2FA off:
 *   - clear `totp_secret` + `totp_enabled` on the aggregate,
 *   - wipe every backup code,
 *   - wipe every trusted-device row (otherwise an attacker who knows the
 *     password could re-enable 2FA and inherit existing trusted devices),
 *   - audit `auth.two_factor.disabled`,
 *   - emit `TwoFactorDisabledEvent` → email alert.
 *
 * Gated behind `FreshPasswordGuard` so the request is only accepted within
 * 5 minutes of the user's last password confirmation.
 */
@Injectable()
export class DisableTotpUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: IBackupCodeRepository,
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly trustedDevices: ITrustedDeviceRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(DisableTotpUseCase.name);
  }

  @Transactional()
  async execute(userId: string): Promise<void> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();

    account.disableTwoFactor();
    await this.accounts.save(account);

    await this.backupCodes.deleteAll(userId);
    await this.trustedDevices.deleteAllForUser(userId);

    await this.audit.log(
      {
        action: 'auth.two_factor.disabled',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: { ipAddress: ip },
      },
      { strict: true },
    );

    for (const event of account.domainEvents) {
      if (event instanceof TwoFactorDisabledEvent) {
        this.events.emit(TwoFactorDisabledEvent.name, event);
      }
    }
    account.clearDomainEvents();

    this.logger.info('TOTP disabled', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
    });
  }
}
