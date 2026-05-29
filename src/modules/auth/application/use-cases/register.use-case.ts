import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  AUTH_EMAIL_SERVICE,
  type IAuthEmailService,
} from '../../domain/ports/auth-email.port';
import {
  PASSWORD_HISTORY_REPOSITORY,
  type IPasswordHistoryRepository,
} from '../../domain/ports/password-history.repository.port';
import {
  EmailAlreadyRegisteredException,
  PasswordPolicyException,
} from '../../domain/exceptions/auth-domain.exception';
import { PlaintextPassword } from '../../domain/value-objects/password.vo';
import { OtpCode } from '../../domain/entities/otp-code.entity';
import { PasswordHistoryEntry, PASSWORD_HISTORY_LIMIT } from '../../domain/entities/password-history.entity';
import { OTP_CODE_TTL_SECONDS } from '../../domain/value-objects/otp-code-type.vo';
import { generateNumericCode } from '../utils/numeric-code.util';
import type { RegisterInput } from '../dto/register.dto';
import type { RegisterResponse } from '../presenters/auth.response';

/**
 * Register a new user:
 *   1. Validate password against the policy (PlaintextPassword) + the HIBP
 *      breached-password screening when enabled.
 *   2. Refuse if the email is already taken.
 *   3. Create the row with `emailVerifiedAt = null`.
 *   4. Append the initial password to PasswordHistory.
 *   5. Issue a 6-digit OTP (30 minutes TTL) and ENQUEUE the verification
 *      email (BullMQ + circuit-breaker handle delivery).
 *   6. Audit `auth.registered`.
 *
 * The whole DB write is wrapped in @Transactional() — a failure to persist
 * any of {user, password_history, otp_code} rolls everything back so we
 * never end up with a user that has no OTP issued. Email enqueue is OUTSIDE
 * the transaction (Postgres can't un-send an email).
 */
@Injectable()
export class RegisterUseCase {
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
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly emails: IAuthEmailService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RegisterUseCase.name);
  }

  async execute(input: RegisterInput): Promise<RegisterResponse> {
    const traceId = this.cls.get<string>(CLS_KEYS.TRACE_ID);

    // 1. Validate password policy (throws PasswordPolicyException).
    PlaintextPassword.create(input.password);

    // 2. Breached-password check (skip transparently when disabled by env).
    if (await this.breachedPassword.isBreached(input.password)) {
      throw new PasswordPolicyException([
        'password has appeared in a known data breach — choose a different one',
      ]);
    }

    // 3. Hash password BEFORE the tx — bcrypt is CPU-heavy; doing it inside
    //    holds the DB connection unnecessarily.
    const passwordHash = await this.hasher.hash(input.password);

    // 4. Generate the verification code now so we know what to email.
    const code = generateNumericCode(6);

    const result = await this.persist({
      input,
      passwordHash,
      code,
    });

    // 5. Audit (fire-and-forget — see audit.port comments).
    await this.audit.log({
      action: 'auth.registered',
      actorId: result.userId,
      resourceType: 'USER',
      resourceId: result.userId,
      metadata: {
        email: input.email.toLowerCase(),
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    // 6. Enqueue the verification email (OUT of any tx).
    await this.emails.sendEmailVerification({
      to: input.email.toLowerCase(),
      code,
      expiresInMinutes: Math.floor(OTP_CODE_TTL_SECONDS.email_verify / 60),
    });

    this.logger.info('User registered', {
      traceId,
      userId: result.userId,
      email: input.email.toLowerCase(),
    });

    return {
      userId: result.userId,
      email: input.email.toLowerCase(),
      verificationCodeExpiresInMinutes: Math.floor(
        OTP_CODE_TTL_SECONDS.email_verify / 60,
      ),
    };
  }

  @Transactional()
  private async persist(args: {
    input: RegisterInput;
    passwordHash: string;
    code: string;
  }): Promise<{ userId: string }> {
    const { input, passwordHash, code } = args;

    // Email uniqueness check inside the tx — concurrent register races
    // are caught by the DB unique index, but the friendly error wins by
    // a millisecond in 99% of cases.
    const existing = await this.accounts.findByEmail(input.email);
    if (existing) throw new EmailAlreadyRegisteredException();

    const now = new Date();
    const ttlDays = this.config.get<number>('PASSWORD_EXPIRES_DAYS', 90);
    const passwordExpiresAt =
      ttlDays > 0
        ? new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
        : null;

    const account = await this.accounts.create({
      name: input.name,
      lastName: input.lastName ?? null,
      email: input.email,
      passwordHash,
      termsAndConditions: input.termsAndConditions,
      passwordExpiresAt,
      passwordChangedAt: now,
    });

    await this.passwordHistory.append(
      PasswordHistoryEntry.create({
        userId: account.id,
        passwordHash,
      }),
      PASSWORD_HISTORY_LIMIT,
    );

    const otp = OtpCode.create({
      userId: account.id,
      code,
      type: 'email_verify',
    });
    await this.otps.create(otp);

    return { userId: account.id };
  }
}
