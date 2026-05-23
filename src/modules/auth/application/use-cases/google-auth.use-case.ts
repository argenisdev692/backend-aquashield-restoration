import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IGoogleAuthPort } from '../../domain/ports/outbound/google-auth.port';
import { GOOGLE_AUTH_PORT } from '../../domain/ports/outbound/google-auth.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import {
  GoogleAuthEvent,
  UserRegisteredEvent,
} from '../../domain/events/auth-events';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';
import { randomBytes } from 'node:crypto';
import type { GoogleAuthInput } from '../dtos/google-auth.dto';

export interface GoogleAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

@Injectable()
export class GoogleAuthUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(GOOGLE_AUTH_PORT)
    private readonly googleAuth: IGoogleAuthPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GoogleAuthUseCase.name);
  }

  async execute(dto: GoogleAuthInput): Promise<GoogleAuthResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GoogleAuth start', { traceId });

    const googleUser = await this.googleAuth.verifyIdToken(dto.idToken);
    if (!googleUser) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const existing = await this.userRepo.findByGoogleId(googleUser.googleId);
    const byEmail = existing
      ? null
      : await this.userRepo.findByEmail(googleUser.email);

    // Pre-hash outside the tx — bcrypt is CPU-bound and would needlessly
    // hold a Postgres connection.
    let preparedPlaceholder: string | null = null;
    if (!existing && !byEmail) {
      const placeholder = randomBytes(32).toString('hex');
      preparedPlaceholder = await this.passwordHasher.hash(placeholder);
    }

    const { user, isNewUser, tokens } = await this.tx.runInTx(async () => {
      let resolvedUser = existing;
      let createdNew = false;

      if (!resolvedUser) {
        if (byEmail) {
          await this.userRepo.setGoogleId(byEmail.id, googleUser.googleId);
          if (googleUser.emailVerified && byEmail.emailVerifiedAt === null) {
            await this.userRepo.setEmailVerified(byEmail.id);
          }
          resolvedUser = { ...byEmail, googleId: googleUser.googleId };
        } else {
          const created = await this.userRepo.create({
            name: googleUser.name,
            email: googleUser.email,
            hashedPassword: preparedPlaceholder!,
            termsAndConditions: true,
          });
          await this.userRepo.setGoogleId(created.id, googleUser.googleId);
          if (googleUser.emailVerified) {
            await this.userRepo.setEmailVerified(created.id);
          }
          resolvedUser = created;
          createdNew = true;
        }
      }

      const issued = await this.tokenIssuer.issue(resolvedUser);
      await this.audit.log(
        {
          action: 'auth.google_login',
          resourceType: 'USER',
          resourceId: resolvedUser.id,
          metadata: { isNewUser: createdNew },
        },
        { strict: true },
      );
      return { user: resolvedUser, isNewUser: createdNew, tokens: issued };
    });

    // Side-effects MUST live outside the tx — emails and event fan-out can
    // not be rolled back if anything inside the tx aborts.
    if (isNewUser) {
      this.eventEmitter.emit(
        'auth.registered',
        new UserRegisteredEvent(user.id, user.email),
      );
      await this.emailPort.sendWelcomeEmail({
        to: user.email,
        name: googleUser.name,
      });
    }

    this.eventEmitter.emit(
      'auth.google_login',
      new GoogleAuthEvent(user.id, isNewUser),
    );

    this.logger.info('GoogleAuth end', { traceId, userId: user.id, isNewUser });
    return { ...tokens, isNewUser };
  }
}
