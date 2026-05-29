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
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  OTP_CODE_REPOSITORY,
  type IOtpCodeRepository,
} from '../../domain/ports/otp-code.repository.port';
import {
  OtpInvalidException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import { constantTimeEquals } from '../utils/numeric-code.util';
import type { VerifyEmailInput } from '../dto/verify-email.dto';

/**
 * Consume the 6-digit `email_verify` OTP issued at register. On success:
 *   1. mark the OTP used,
 *   2. set `users.email_verified_at`,
 *   3. audit `auth.email_verified`.
 *
 * The OTP comparison uses constant-time equality (no early exit). Wrong
 * code / wrong email is reported identically (`AUTH_OTP_INVALID`) so an
 * attacker cannot enumerate which emails are registered.
 */
@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otps: IOtpCodeRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(VerifyEmailUseCase.name);
  }

  @Transactional()
  async execute(input: VerifyEmailInput): Promise<void> {
    const account = await this.accounts.findByEmail(input.email);
    if (!account) {
      // Deliberately the same error as a wrong code — no enumeration.
      throw new OtpInvalidException();
    }
    if (account.isEmailVerified()) {
      // Idempotent — already verified.
      return;
    }

    const otp = await this.otps.findLatestActive(account.id, 'email_verify');
    if (!otp) throw new OtpInvalidException();
    if (!constantTimeEquals(otp.code, input.code)) {
      throw new OtpInvalidException();
    }
    otp.consume(input.code);
    await this.otps.save(otp);

    account.verifyEmail();
    await this.accounts.save(account);

    await this.audit.log(
      {
        action: 'auth.email_verified',
        actorId: account.id,
        resourceType: 'USER',
        resourceId: account.id,
      },
      { strict: true },
    );

    this.logger.info('Email verified', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: account.id,
    });
  }
}
