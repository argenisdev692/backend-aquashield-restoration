import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { ITokenServicePort } from '../../domain/ports/outbound/token-service.port';
import { TOKEN_SERVICE_PORT } from '../../domain/ports/outbound/token-service.port';
import {
  AuthSession,
  deviceLabelFromUserAgent,
} from '../../domain/entities/auth-session.aggregate';
import { RefreshToken } from '../../domain/value-objects/refresh-token.vo';
import { requires2faEnrollment } from '../../domain/constants/admin-roles';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** True when the account is admin/superadmin and has not enrolled TOTP yet. */
  mustEnroll2fa?: boolean;
  /** True when no prior active session shares the current UA or IP. */
  isNewDevice?: boolean;
}

export interface IssuerUser {
  id: string;
  email: string;
  roleIds: string[];
  roleNames: string[];
  totpEnabled: boolean;
}

/**
 * Collaborator (not a UseCase) that mints an access token + persists a fresh
 * refresh-token session. Audit / events / logging stay with the calling
 * UseCase so each one keeps a single `execute()` entry point.
 *
 * Side-effects pulled from CLS (never threaded as args):
 *   • ip / userAgent — stamped on the session row
 *   • new-device detection — driven by AuthSessionRepository
 */
@Injectable()
export class AuthTokenIssuer {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenServicePort,
    private readonly cls: ClsService,
  ) {}

  async issue(user: IssuerUser): Promise<IssuedTokens> {
    const userAgent = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
    const ipAddress = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    // Detect "new device" BEFORE we persist this session so the lookup does
    // not match itself. Treat failure as "known" (fail-open) so a transient
    // DB error never sends a spurious alert.
    let isNewDevice = false;
    try {
      isNewDevice = !(await this.sessionRepo.hasMatchingActiveSession(
        user.id,
        userAgent,
        ipAddress,
      ));
    } catch {
      isNewDevice = false;
    }

    const { token, expiresInSeconds } = await this.tokenService.signAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleIds: user.roleIds,
        roleNames: user.roleNames,
      },
    );

    const refreshTokenVo = RefreshToken.generate();
    const session = AuthSession.create({
      id: '', // DB-generated UUID v7
      userId: user.id,
      refreshToken: refreshTokenVo,
      userAgent,
      deviceLabel: deviceLabelFromUserAgent(userAgent),
      ipAddress,
      deviceInfo: userAgent || ipAddress ? { userAgent: userAgent ?? undefined, ip: ipAddress ?? undefined } : null,
      expiresAt: new Date(Date.now() + this.tokenService.refreshTtlMs(user.roleNames)),
    });
    await this.sessionRepo.save(session);

    // The raw token leaves the boundary exactly once, here. Persistence
    // stored only `refreshTokenVo.hash` via the mapper.
    return {
      accessToken: token,
      refreshToken: refreshTokenVo.raw,
      expiresIn: expiresInSeconds,
      mustEnroll2fa: requires2faEnrollment(user) || undefined,
      isNewDevice: isNewDevice || undefined,
    };
  }
}
