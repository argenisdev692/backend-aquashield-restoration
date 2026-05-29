import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
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
import { UserAccountNotFoundException } from '../../domain/exceptions/auth-domain.exception';

/**
 * Unlink the Google identity from the account. Gated behind
 * `FreshPasswordGuard` at the controller. Refuses to unlink if the account
 * has NO password set, otherwise the user would lose access entirely.
 */
@Injectable()
export class UnlinkGoogleAccountUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UnlinkGoogleAccountUseCase.name);
  }

  @Transactional()
  async execute(userId: string): Promise<void> {
    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();
    if (!account.googleId) {
      throw new BadRequestException({
        code: 'AUTH_NO_GOOGLE_LINK',
        message: 'No Google account is linked',
      });
    }
    if (!account.hasPasswordAuth()) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_REQUIRED_BEFORE_UNLINK',
        message:
          'Set a password before unlinking Google — otherwise you would lose access',
      });
    }

    account.unlinkGoogleAccount();
    await this.accounts.save(account);

    await this.audit.log(
      {
        action: 'auth.social.unlinked',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: {
          provider: 'google',
          ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
        },
      },
      { strict: true },
    );

    this.logger.info('Google account unlinked', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
    });
  }
}
