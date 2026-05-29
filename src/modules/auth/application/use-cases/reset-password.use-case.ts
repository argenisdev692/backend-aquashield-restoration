import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  BREACHED_PASSWORD_PORT,
  type IBreachedPasswordPort,
} from '../../../../shared/security/breached-password.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  OTP_CODE_REPOSITORY,
  type IOtpCodeRepository,
} from '../../domain/ports/otp-code.repository.port';
import {
  PASSWORD_HISTORY_REPOSITORY,
  type IPasswordHistoryRepository,
} from '../../domain/ports/password-history.repository.port';
import {
  OtpInvalidException,
  PasswordPolicyException,
  PasswordReusedException,
} from '../../domain/exceptions/auth-domain.exception';
import { PlaintextPassword } from '../../domain/value-objects/password.vo';
import {
  PasswordHistoryEntry,
  PASSWORD_HISTORY_LIMIT,
} from '../../domain/entities/password-history.entity';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';
import { constantTimeEquals } from '../utils/numeric-code.util';
import type { ResetPasswordInput } from '../dto/reset-password.dto';

/**
 * Consume a `password_reset` OTP and set a new password.
 *
 * Sequence (inside one transaction):
 *   1. Verify the OTP (constant-time compare; same error for any failure mode).
 *   2. Validate the new password against policy + HIBP + history (last 5).
 *   3. Hash + persist via `account.changePassword('reset')`. The aggregate
 *      emits `PasswordChangedEvent` which a listener uses to revoke ALL
 *      sessions and to email both the request and completion notifications.
 *   4. Append the new hash to password_history (pruned to 5).
 *   5. Audit `auth.password.reset` with strict=true so audit failure rolls
 *      everything back.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otps: IOtpCodeRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY)
    private readonly passwordHistory: IPasswordHistoryRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
    @Inject(BREACHED_PASSWORD_PORT)
    private readonly breachedPassword: IBreachedPasswordPort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ResetPasswordUseCase.name);
  }

  async execute(input: ResetPasswordInput): Promise<void> {
    // Domain policy (length + character classes).
    PlaintextPassword.create(input.newPassword);
    if (await this.breachedPassword.isBreached(input.newPassword)) {
      throw new PasswordPolicyException([
        'password has appeared in a known data breach — choose a different one',
      ]);
    }

    // Hash outside the tx — bcrypt is CPU-heavy.
    const newHash = await this.hasher.hash(input.newPassword);

    await this.commit(input, newHash);

    this.logger.info('Password reset complete', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      email: input.email.toLowerCase(),
    });
  }

  @Transactional()
  private async commit(
    input: ResetPasswordInput,
    newHash: string,
  ): Promise<void> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    const account = await this.accounts.findByEmail(input.email);
    // Same error as wrong code → no enumeration.
    if (!account) throw new OtpInvalidException();

    const otp = await this.otps.findLatestActive(account.id, 'password_reset');
    if (!otp || !constantTimeEquals(otp.code, input.code)) {
      throw new OtpInvalidException();
    }
    otp.consume(input.code);
    await this.otps.save(otp);

    // No-reuse: compare new plaintext against the last 5 hashes.
    const recent = await this.passwordHistory.findRecentHashes(
      account.id,
      PASSWORD_HISTORY_LIMIT,
    );
    for (const old of recent) {
      if (await this.hasher.compare(input.newPassword, old)) {
        throw new PasswordReusedException(PASSWORD_HISTORY_LIMIT);
      }
    }

    account.changePassword(newHash, 'reset', {
      keepSessionId: null, // reset always revokes EVERY session
      ipAddress: ip,
      passwordTtlDays: this.config.get<number>('PASSWORD_EXPIRES_DAYS', 90),
    });
    await this.accounts.save(account);

    await this.passwordHistory.append(
      PasswordHistoryEntry.create({ userId: account.id, passwordHash: newHash }),
      PASSWORD_HISTORY_LIMIT,
    );

    await this.audit.log(
      {
        action: 'auth.password.reset',
        actorId: account.id,
        resourceType: 'USER',
        resourceId: account.id,
        metadata: { ipAddress: ip },
      },
      { strict: true },
    );

    // Forward the aggregate's PasswordChangedEvent so the listener can
    // revoke sessions and email the owner.
    for (const event of account.domainEvents) {
      if (event instanceof PasswordChangedEvent) {
        this.events.emit(PasswordChangedEvent.name, event);
      }
    }
    account.clearDomainEvents();
  }
}
