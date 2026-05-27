import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface SignedAccessToken {
  token: string;
  expiresInSeconds: number;
}

/**
 * JWT access-token adapter. Owns the single copy of the `<n><unit>` expiry
 * parsing that previously lived (duplicated) in two use cases.
 *
 * TTL split: admins get a shorter session (default 1h access / 8h refresh)
 * because a stolen admin token is the worst case. Regular users default to
 * the longer JWT_*_EXPIRES_IN values. Both can be tuned via env without
 * touching code.
 */
@Injectable()
export class JwtTokenAdapter {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(params: {
    userId: string;
    email: string;
    roleIds: string[];
    roleNames: string[];
  }): Promise<SignedAccessToken> {
    const expiresInSeconds = this.accessTtlSeconds(params.roleNames);

    const token = await this.jwtService.signAsync(
      {
        email: params.email,
        roleIds: params.roleIds,
        roleNames: params.roleNames,
      },
      {
        expiresIn: expiresInSeconds,
        subject: params.userId,
        algorithm: 'HS256',
      },
    );

    return { token, expiresInSeconds };
  }

  refreshTtlMs(roleNames: string[]): number {
    const value = this.isPrivileged(roleNames)
      ? this.config.get<string>('JWT_ADMIN_REFRESH_EXPIRES_IN', '8h')
      : this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    return this.toSeconds(value) * 1000;
  }

  async signPasswordChangeToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { scope: 'password_change' },
      {
        expiresIn: 900, // 15 minutes
        subject: userId,
        algorithm: 'HS256',
      },
    );
  }

  async verifyPasswordChangeToken(token: string): Promise<{ userId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        scope: string;
      }>(token, { algorithms: ['HS256'] });
      if (payload.scope !== 'password_change') {
        throw new Error('Invalid token scope');
      }
      return { userId: payload.sub };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  private accessTtlSeconds(roleNames: string[]): number {
    const value = this.isPrivileged(roleNames)
      ? this.config.get<string>('JWT_ADMIN_ACCESS_EXPIRES_IN', '1h')
      : this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    return this.toSeconds(value);
  }

  private isPrivileged(roleNames: string[]): boolean {
    const TWO_FACTOR_REQUIRED_ROLES = ['admin', 'superadmin'];
    return roleNames.some((n) => TWO_FACTOR_REQUIRED_ROLES.includes(n));
  }

  private toSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) return 900; // default 15m
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return num;
      case 'm':
        return num * 60;
      case 'h':
        return num * 60 * 60;
      case 'd':
        return num * 24 * 60 * 60;
      default:
        return 900;
    }
  }
}
