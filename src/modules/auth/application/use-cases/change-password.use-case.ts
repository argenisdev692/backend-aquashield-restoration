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
  PASSWORD_HISTORY_REPOSITORY,
  type IPasswordHistoryRepository,
} from '../../domain/ports/password-history.repository.port';
import { PlaintextPassword } from '../../domain/value-objects/password.vo';
import {
  InvalidCredentialsException,
  PasswordPolicyException,
  PasswordReusedException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import {
  PasswordHistoryEntry,
  PASSWORD_HISTORY_LIMIT,
} from '../../domain/entities/password-history.entity';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';
import type { ChangePasswordInput } from '../dto/change-password.dto';

/**
 * Authenticated user changes their own password.
 *
 * Sequence:
 *   1. Verify the CURRENT password (bcrypt.compare) — wrong → 401.
 *   2. Validate the new password (policy + HIBP + last-5 no-reuse).
 *   3. Hash + persist via `account.changePassword('change', { keepSessionId })`.
 *      The listener revokes every session EXCEPT the current one so the
 *      user does not get logged out of the tab they just used.
 *   4. Audit (`strict: true`).
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
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
    this.logger.setContext(ChangePasswordUseCase.name);
  }

  async execute(args: {
    userId: string;
    currentSessionId?: string;
    input: ChangePasswordInput;
  }): Promise<void> {
    PlaintextPassword.create(args.input.newPassword);
    if (await this.breachedPassword.isBreached(args.input.newPassword)) {
      throw new PasswordPolicyException([
        'password has appeared in a known data breach — choose a different one',
      ]);
    }

    const newHash = await this.hasher.hash(args.input.newPassword);
    await this.commit({
      userId: args.userId,
      currentSessionId: args.currentSessionId,
      currentPassword: args.input.currentPassword,
      newPassword: args.input.newPassword,
      newHash,
    });

    this.logger.info('Password changed', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
    });
  }

  @Transactional()
  private async commit(args: {
    userId: string;
    currentSessionId?: string;
    currentPassword: string;
    newPassword: string;
    newHash: string;
  }): Promise<void> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    const account = await this.accounts.findById(args.userId);
    if (!account) throw new UserAccountNotFoundException();
    if (!account.passwordHash) {
      // Social-only users have no password to verify; they should set one
      // via a separate "set password" flow (out of scope here).
      throw new InvalidCredentialsException();
    }
    const ok = await this.hasher.compare(
      args.currentPassword,
      account.passwordHash,
    );
    if (!ok) throw new InvalidCredentialsException();

    const recent = await this.passwordHistory.findRecentHashes(
      account.id,
      PASSWORD_HISTORY_LIMIT,
    );
    for (const old of recent) {
      if (await this.hasher.compare(args.newPassword, old)) {
        throw new PasswordReusedException(PASSWORD_HISTORY_LIMIT);
      }
    }

    account.changePassword(args.newHash, 'change', {
      keepSessionId: args.currentSessionId ?? null,
      ipAddress: ip,
      passwordTtlDays: this.config.get<number>('PASSWORD_EXPIRES_DAYS', 90),
    });
    await this.accounts.save(account);

    await this.passwordHistory.append(
      PasswordHistoryEntry.create({
        userId: account.id,
        passwordHash: args.newHash,
      }),
      PASSWORD_HISTORY_LIMIT,
    );

    await this.audit.log(
      {
        action: 'auth.password.changed',
        actorId: account.id,
        resourceType: 'USER',
        resourceId: account.id,
        metadata: { ipAddress: ip },
      },
      { strict: true },
    );

    for (const event of account.domainEvents) {
      if (event instanceof PasswordChangedEvent) {
        this.events.emit(PasswordChangedEvent.name, event);
      }
    }
    account.clearDomainEvents();
  }
}
