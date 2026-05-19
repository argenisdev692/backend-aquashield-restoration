import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordHistoryRepository } from '../../domain/repositories/password-history.repository.interface';
import { PASSWORD_HISTORY_REPOSITORY } from '../../domain/repositories/password-history.repository.interface';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import { PASSWORD_RESET_REPOSITORY } from '../../domain/repositories/password-reset.repository.interface';
import type { IOtpRepository } from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import { ResetToken } from '../../domain/value-objects/reset-token.vo';
import { PasswordResetEvent } from '../../domain/events/auth-events';
import type { IBreachedPasswordPort } from '../../../../shared/security/breached-password.port';
import {
  BREACHED_PASSWORD_PORT,
  BREACHED_PASSWORD_MESSAGE,
} from '../../../../shared/security/breached-password.port';
import type { ResetPasswordInput } from '../dtos/reset-password.dto';

const PASSWORD_HISTORY_CHECK_LIMIT = 5;
const PASSWORD_HISTORY_KEEP = 10;

const INVALID_MSG = 'Invalid or expired password reset token';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY)
    private readonly historyRepo: IPasswordHistoryRepository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly resetRepo: IPasswordResetRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(BREACHED_PASSWORD_PORT)
    private readonly breachedPwd: IBreachedPasswordPort,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResetPasswordUseCase.name);
  }

  async execute(dto: ResetPasswordInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Reset password attempt', { traceId });

    // Verify the reset token session.
    const tokenHash = ResetToken.hashOf(dto.resetToken);
    const tokenRow = await this.resetRepo.findValid(tokenHash);
    if (!tokenRow) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    // Verify the email belongs to the token owner.
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || user.id !== tokenRow.userId) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    // Verify the 6-digit OTP code sent to email.
    const otpRow = await this.otpRepo.findValid(user.id, 'password_reset');
    if (!otpRow || !OtpCode.safeEqual(dto.code, otpRow.code)) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // Check password history to prevent reuse of recent passwords.
    const recentHashes = await this.historyRepo.getRecent(
      user.id,
      PASSWORD_HISTORY_CHECK_LIMIT,
    );
    for (const hash of recentHashes) {
      const isReused = await this.passwordHasher.compare(dto.password, hash);
      if (isReused) {
        throw new BadRequestException(
          `New password must differ from your last ${PASSWORD_HISTORY_CHECK_LIMIT} passwords`,
        );
      }
    }

    if (await this.breachedPwd.isBreached(dto.password)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const now = new Date();
    const passwordExpiresAt = this.computeExpiresAt(now);

    await this.tx.runInTx(async () => {
      await this.otpRepo.markUsed(otpRow.id);
      await this.resetRepo.markUsed(tokenRow.id);
      await this.historyRepo.addEntry(user.id, hashedPassword);
      await this.historyRepo.pruneOldest(user.id, PASSWORD_HISTORY_KEEP);
      await this.userRepo.updatePasswordWithStatus(
        user.id,
        hashedPassword,
        now,
        passwordExpiresAt,
      );
      await this.sessionRepo.revokeAllForUser(user.id);
    });

    this.eventEmitter.emit(
      'auth.password_reset',
      new PasswordResetEvent(user.id),
    );

    await this.audit.log({
      action: 'auth.password_reset',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('Password reset complete', { traceId, userId: user.id });
  }

  private computeExpiresAt(from: Date): Date | null {
    const days = this.config.get<number>('PASSWORD_EXPIRES_DAYS', 90);
    if (days === 0) return null;
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
