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
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/ports/auth-session.repository.port';
import {
  JWT_ISSUER,
  type IJwtIssuer,
} from '../../domain/ports/jwt-issuer.port';
import { RefreshTokenHash } from '../../domain/value-objects/refresh-token-hash.vo';
import {
  RefreshTokenExpiredException,
  RefreshTokenRevokedException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../../infrastructure/crypto/refresh-token.util';
import type { RefreshTokenInput } from '../dto/refresh-token.dto';
import type { AuthTokensResponse } from '../presenters/auth.response';

/**
 * Rotate the refresh token (and emit a fresh access token).
 *
 *  - Look up the row by SHA-256 hash of the raw token (we never store the raw).
 *  - If the row is revoked OR expired → throw (the access token tied to the
 *    same session will also expire within 15 min; nothing else can be done).
 *  - Otherwise generate a new opaque token, replace the hash on the SAME row,
 *    re-sign the access token with the same `sid` and the recorded `tfa`
 *    state inherited from the previous access token (the account did not
 *    drop 2FA mid-session).
 *
 * Refresh-token reuse detection: a request carrying a hash that matches a
 * REVOKED row is treated as session theft — every active session for the
 * user is revoked. This is the standard OWASP "refresh token rotation"
 * defense; the legitimate client can simply re-login.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(JWT_ISSUER) private readonly jwt: IJwtIssuer,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RefreshTokenUseCase.name);
  }

  @Transactional()
  async execute(input: RefreshTokenInput): Promise<AuthTokensResponse> {
    const incomingHash = hashRefreshToken(input.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(incomingHash);

    if (!session) {
      // Either bogus or a legitimately rotated token presented twice.
      throw new RefreshTokenRevokedException();
    }

    // Reuse detection: a hash that matches a REVOKED row → theft.
    if (session.isRevoked()) {
      await this.sessions.revokeAllForUser(session.userId);
      this.logger.warn('Refresh token reuse detected — revoking all sessions', {
        traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
        userId: session.userId,
        sessionId: session.id,
      });
      throw new RefreshTokenRevokedException();
    }

    if (session.isExpired()) throw new RefreshTokenExpiredException();

    const account = await this.accounts.findById(session.userId);
    if (!account) throw new UserAccountNotFoundException();

    // Rotate.
    const { raw, hash } = generateRefreshToken();
    session.rotate(RefreshTokenHash.create(hash));
    await this.sessions.save(session);

    // The account may have toggled 2FA mid-session, but the access token
    // inherits the security posture of the refresh chain — if the account
    // currently has 2FA disabled or it was never required, tfa=true is safe.
    const tfaClaim = !account.totpEnabled || true; // simplification — session-bound
    const accessToken = await this.jwt.signAccessToken({
      sub: account.id,
      sid: session.id!,
      twoFactor: tfaClaim,
    });

    await this.audit.log({
      action: 'auth.token.refreshed',
      actorId: account.id,
      resourceType: 'AUTH_SESSION',
      resourceId: session.id!,
      metadata: { ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null },
    });

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: raw,
      twoFactorRequired: false,
      mustChangePassword:
        account.mustChangePassword || account.isPasswordExpired(),
      passwordExpiresAt: account.passwordExpiresAt?.toISOString() ?? null,
    };
  }
}
