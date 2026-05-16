import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
import { GoogleAuthEvent, UserRegisteredEvent } from '../../domain/events/auth-events';
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

    let user = await this.userRepo.findByGoogleId(googleUser.googleId);
    let isNewUser = false;

    if (!user) {
      const byEmail = await this.userRepo.findByEmail(googleUser.email);
      if (byEmail) {
        await this.userRepo.setGoogleId(byEmail.id, googleUser.googleId);
        if (googleUser.emailVerified && byEmail.emailVerifiedAt === null) {
          await this.userRepo.setEmailVerified(byEmail.id);
        }
        user = { ...byEmail, googleId: googleUser.googleId };
      } else {
        const placeholder = randomBytes(32).toString('hex');
        const hashedPassword = await this.passwordHasher.hash(placeholder);
        user = await this.userRepo.create({
          name: googleUser.name,
          email: googleUser.email,
          hashedPassword,
          termsAndConditions: true,
        });
        await this.userRepo.setGoogleId(user.id, googleUser.googleId);
        if (googleUser.emailVerified) {
          await this.userRepo.setEmailVerified(user.id);
        }
        isNewUser = true;

        this.eventEmitter.emit(
          'auth.registered',
          new UserRegisteredEvent(user.id, user.email),
        );
        await this.emailPort.sendWelcomeEmail({
          to: user.email,
          name: googleUser.name,
        });
      }
    }

    const tokens = await this.tokenIssuer.issue(user);

    this.eventEmitter.emit(
      'auth.google_login',
      new GoogleAuthEvent(user.id, isNewUser),
    );

    await this.audit.log({
      action: 'auth.google_login',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: { isNewUser },
    });

    this.logger.info('GoogleAuth end', { traceId, userId: user.id, isNewUser });
    return { ...tokens, isNewUser };
  }
}
