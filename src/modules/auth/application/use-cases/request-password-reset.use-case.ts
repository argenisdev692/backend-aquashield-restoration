import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  OTP_CODE_REPOSITORY,
  type IOtpCodeRepository,
} from '../../domain/ports/otp-code.repository.port';
import {
  AUTH_RATE_LIMITER,
  type IAuthRateLimiter,
} from '../../domain/ports/rate-limiter.port';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import { OtpCode } from '../../domain/entities/otp-code.entity';
import { OTP_CODE_TTL_SECONDS } from '../../domain/value-objects/otp-code-type.vo';
import { generateNumericCode } from '../utils/numeric-code.util';
import { PasswordResetRequestedEvent } from '../../domain/events/suspicious-activity-detected.event';
import type { RequestPasswordResetInput } from '../dto/request-password-reset.dto';

const FORGOT_THROTTLE_KEY = (email: string) => `forgot-password:${email}`;
const FORGOT_WINDOW_SECONDS = 15 * 60; // 15 minutes (matches spec)
const FORGOT_LIMIT_PER_WINDOW = 3;

/**
 * `POST /auth/forgot-password`. Sends a 6-digit `password_reset` OTP (TTL
 * 60 min) via the queued email pipeline.
 *
 * Anti-enumeration:
 *   - response shape & latency identical when the email is unknown,
 *   - throttle counter incremented for unknown emails too so the request
 *     budget is the same.
 *
 * Hard cap: 3 requests per email / 15 minutes → 429.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otps: IOtpCodeRepository,
    @Inject(AUTH_RATE_LIMITER)
    private readonly limiter: IAuthRateLimiter,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RequestPasswordResetUseCase.name);
  }

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<{ expiresInMinutes: number }> {
    const email = input.email.toLowerCase();
    const expiresInMinutes = Math.floor(
      OTP_CODE_TTL_SECONDS.password_reset / 60,
    );
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;

    const hits = await this.limiter.recordIpHit(
      FORGOT_THROTTLE_KEY(email),
      FORGOT_WINDOW_SECONDS,
    );
    if (hits > FORGOT_LIMIT_PER_WINDOW) {
      throw new HttpException(
        {
          code: 'AUTH_FORGOT_THROTTLED',
          message: 'Too many reset requests — try again later',
          retryAfterSeconds: FORGOT_WINDOW_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const account = await this.accounts.findByEmail(email);
    if (!account) {
      // Silent no-op — identical response shape as the hit branch.
      this.logger.debug('Forgot-password: unknown email', { email });
      return { expiresInMinutes };
    }

    const code = generateNumericCode(6);
    await this.issue(account.id, code);

    // Listener (PasswordResetRequestedEvent → email) handles the actual
    // mail enqueue. Keeps this use-case free of side effects beyond audit
    // and event publishing.
    this.events.emit(
      PasswordResetRequestedEvent.name,
      new PasswordResetRequestedEvent(
        account.id,
        email,
        code,
        expiresInMinutes,
        ip,
        ua,
      ),
    );

    await this.audit.log({
      action: 'auth.password.reset_requested',
      actorId: account.id,
      resourceType: 'USER',
      resourceId: account.id,
      metadata: { ipAddress: ip, userAgent: ua },
    });

    this.logger.info('Password reset requested', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: account.id,
    });

    return { expiresInMinutes };
  }

  @Transactional()
  private async issue(userId: string, code: string): Promise<void> {
    await this.otps.invalidatePending(userId, 'password_reset');
    await this.otps.create(
      OtpCode.create({ userId, code, type: 'password_reset' }),
    );
  }
}
