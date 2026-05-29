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
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  GOOGLE_OAUTH_PROVIDER,
  type IOAuthProvider,
} from '../../domain/ports/oauth-provider.port';
import { resolveRefreshTtlDays } from '../utils/session-ttl.util';
import { SocialAccountLinkedEvent } from '../../domain/events/suspicious-activity-detected.event';
import { NewDeviceDetectedEvent } from '../../domain/events/new-device-detected.event';
import { LoginSucceededEvent } from '../../domain/events/login-succeeded.event';
import { SessionIssuer } from '../session-issuer.service';
import type { AuthTokensResponse } from '../presenters/auth.response';

/**
 * Google OAuth callback. The controller has already verified the OAuth
 * `state` value (CSRF) and forwards us the `code`. We:
 *   1. Exchange the code for a verified Google profile (email_verified === true).
 *   2. Match-by-googleId → match-by-email → create-new-user, in order.
 *      Account-takeover protection: if the email maps to an EXISTING user
 *      without a linked googleId, we LINK silently because the email is
 *      verified by Google AND by us at register; otherwise we'd be
 *      preventing legitimate consolidation.
 *   3. Issue a fully-authenticated session (2FA enforced if enabled —
 *      Google sign-in doesn't bypass 2FA).
 *   4. Emit `SocialAccountLinkedEvent` when this is the first link
 *      → email alert to the owner.
 */
@Injectable()
export class GoogleOAuthCallbackUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(GOOGLE_OAUTH_PROVIDER)
    private readonly google: IOAuthProvider,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly sessionIssuer: SessionIssuer,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(GoogleOAuthCallbackUseCase.name);
  }

  async execute(args: {
    code: string;
  }): Promise<
    | AuthTokensResponse
    | {
        twoFactorRequired: true;
        accessToken: string;
        accessTokenExpiresAt: string;
        mustChangePassword: boolean;
        passwordExpiresAt: string | null;
      }
  > {
    const profile = await this.google.exchangeCode(args.code);

    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;

    const { account, justLinked } = await this.findOrCreate(profile);
    const ttlDays = await resolveRefreshTtlDays(this.prisma, account.id);

    // Match the login flow: respect 2FA when enabled on the account.
    const issued = await this.sessionIssuer.issue(
      account,
      { ipAddress: ip, userAgent: ua },
      !account.totpEnabled,
      ttlDays,
    );

    await this.audit.log({
      action: 'auth.login.google',
      actorId: account.id,
      resourceType: 'USER',
      resourceId: account.id,
      metadata: { ipAddress: ip, justLinked },
    });

    this.events.emit(
      LoginSucceededEvent.name,
      new LoginSucceededEvent(
        account.id,
        issued.sessionId,
        ua ?? '',
        ip,
        ua,
        issued.isNewDevice,
      ),
    );

    if (issued.isNewDevice) {
      this.events.emit(
        NewDeviceDetectedEvent.name,
        new NewDeviceDetectedEvent(
          account.id,
          account.email.value,
          issued.sessionId,
          null,
          ua,
          ip,
        ),
      );
    }

    if (justLinked) {
      this.events.emit(
        SocialAccountLinkedEvent.name,
        new SocialAccountLinkedEvent(
          account.id,
          account.email.value,
          'google',
          ip,
        ),
      );
    }

    this.logger.info('Google login succeeded', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: account.id,
      justLinked,
    });

    const mustChangePassword =
      account.mustChangePassword || account.isPasswordExpired();
    const passwordExpiresAtIso =
      account.passwordExpiresAt?.toISOString() ?? null;

    if (account.totpEnabled) {
      return {
        twoFactorRequired: true,
        accessToken: issued.accessToken,
        accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
        mustChangePassword,
        passwordExpiresAt: passwordExpiresAtIso,
      };
    }

    return {
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
      refreshToken: issued.refreshToken,
      twoFactorRequired: false,
      mustChangePassword,
      passwordExpiresAt: passwordExpiresAtIso,
    };
  }

  @Transactional()
  private async findOrCreate(
    profile: { providerId: string; email: string; givenName: string | null; familyName: string | null },
  ): Promise<{ account: Awaited<ReturnType<IUserAccountRepository['create']>>; justLinked: boolean }> {
    // 1. Already linked.
    const byGoogle = await this.accounts.findByGoogleId(profile.providerId);
    if (byGoogle) {
      return { account: byGoogle, justLinked: false };
    }

    // 2. Existing user with same email → link (email is provider-verified).
    const byEmail = await this.accounts.findByEmail(profile.email);
    if (byEmail) {
      byEmail.linkGoogleAccount(profile.providerId);
      await this.accounts.save(byEmail);
      return { account: byEmail, justLinked: true };
    }

    // 3. Brand-new user. Password is null — they must set one via
    //    request-password-change if they ever want password login.
    const created = await this.accounts.create({
      name: profile.givenName ?? profile.email.split('@')[0],
      lastName: profile.familyName ?? null,
      email: profile.email,
      passwordHash: null,
      googleId: profile.providerId,
      emailVerifiedAt: new Date(),
      termsAndConditions: true,
    });
    return { account: created, justLinked: true };
  }
}
