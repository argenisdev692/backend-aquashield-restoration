import { Inject, Injectable } from '@nestjs/common';
import {
  AuthSession,
  REFRESH_TOKEN_TTL_DAYS_USER,
} from '../domain/entities/auth-session.entity';
import { UserAccount } from '../domain/entities/user-account.aggregate';
import { RefreshTokenHash } from '../domain/value-objects/refresh-token-hash.vo';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../domain/ports/auth-session.repository.port';
import { JWT_ISSUER, type IJwtIssuer } from '../domain/ports/jwt-issuer.port';
import {
  TRUSTED_DEVICE_REPOSITORY,
  type ITrustedDeviceRepository,
} from '../domain/ports/trusted-device.repository.port';
import { generateRefreshToken } from '../infrastructure/crypto/refresh-token.util';
import { createHash } from 'node:crypto';

export interface IssueSessionContext {
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel?: string | null;
  /** Raw trusted-device cookie (`td`) if the client sent it. */
  trustedDeviceToken?: string | null;
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  /** Raw refresh token — shown to the client ONCE, never again. */
  refreshToken: string;
  isNewDevice: boolean;
  /** True when the caller's `trustedDeviceToken` matched a valid 30-day cookie. */
  twoFactorBypassed: boolean;
}

/**
 * Application-level helper that:
 *   1. Generates a refresh token + persists its hash in `auth_sessions`,
 *   2. Signs the access token with the right `tfa` claim,
 *   3. Detects whether this is a "new device" (no prior active session
 *      with the same user-agent fingerprint) so the listener can email
 *      the owner,
 *   4. Optionally bypasses the 2FA challenge when the caller presents a
 *      valid `td` (trusted-device) cookie matching one we issued.
 *
 * Kept OUTSIDE individual use-cases so the same emission logic powers
 * password-login, social-login, and 2FA-verify without duplication.
 */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(JWT_ISSUER) private readonly jwt: IJwtIssuer,
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly trustedDevices: ITrustedDeviceRepository,
  ) {}

  /**
   * Emit a fully-authenticated session (call only AFTER credentials + any
   * 2FA challenge have been satisfied). When the account has 2FA enabled
   * the caller may pass `twoFactorSatisfied=false` to emit a mid-challenge
   * access token instead (used by the password-login use-case).
   */
  async issue(
    account: UserAccount,
    ctx: IssueSessionContext,
    twoFactorSatisfied: boolean,
    /**
     * Refresh-token lifetime in days. Caller decides — typically:
     *   - 30 days (REFRESH_TOKEN_TTL_DAYS_USER) for regular users
     *   - 7 days (REFRESH_TOKEN_TTL_DAYS_ADMIN) for admin / super-admin
     *     accounts (matches the "tighter session for elevated roles" rule
     *     from the spec). Omit to keep the user default.
     */
    ttlDays: number = REFRESH_TOKEN_TTL_DAYS_USER,
  ): Promise<IssuedSession> {
    const { raw, hash } = generateRefreshToken();
    const session = AuthSession.create({
      userId: account.id,
      refreshTokenHash: RefreshTokenHash.create(hash),
      deviceInfo: null,
      userAgent: ctx.userAgent,
      deviceLabel: ctx.deviceLabel ?? null,
      ipAddress: ctx.ipAddress,
      ttlDays,
    });

    const sessionId = await this.sessions.create(session);

    const accessToken = await this.jwt.signAccessToken({
      sub: account.id,
      sid: sessionId,
      twoFactor: twoFactorSatisfied,
    });

    const isNewDevice = await this.detectNewDevice(account.id, ctx.userAgent);

    return {
      sessionId,
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: raw,
      isNewDevice,
      twoFactorBypassed: false,
    };
  }

  /**
   * Returns true if the raw trusted-device cookie matches an unexpired row
   * for this user. Also touches `lastUsedAt`. The caller (LoginUseCase)
   * uses this to decide whether to pass `twoFactorSatisfied=true` to `issue`.
   */
  async resolveTrustedDevice(
    userId: string,
    rawToken: string | null,
  ): Promise<boolean> {
    return this.checkTrustedDevice(userId, rawToken);
  }

  /**
   * Detect a "new device" sign-in by comparing the incoming user-agent to
   * the user's prior ACTIVE sessions. Conservative heuristic (substring
   * match) — overly cautious extra emails are fine; missing a real new
   * device sign-in is not.
   */
  private async detectNewDevice(
    userId: string,
    userAgent: string | null,
  ): Promise<boolean> {
    if (!userAgent) return false;
    const active = await this.sessions.findActiveByUserId(userId);
    if (active.length <= 1) return true; // first session ever for this user
    const fingerprint = fingerprintUserAgent(userAgent);
    return !active.some(
      (s) => s.userAgent && fingerprintUserAgent(s.userAgent) === fingerprint,
    );
  }

  private async checkTrustedDevice(
    userId: string,
    rawToken: string | null,
  ): Promise<boolean> {
    if (!rawToken) return false;
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const device = await this.trustedDevices.findByTokenHash(hash);
    if (!device) return false;
    if (device.userId !== userId) return false;
    if (device.isExpired()) return false;
    device.touch();
    await this.trustedDevices.save(device);
    return true;
  }
}

/**
 * Reduce a User-Agent string to a coarse fingerprint (browser + os tokens)
 * so we don't classify "same browser, different minor version" as new.
 */
function fingerprintUserAgent(ua: string): string {
  return ua
    .toLowerCase()
    .replace(/[0-9.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
