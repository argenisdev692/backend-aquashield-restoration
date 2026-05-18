import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  ITokenServicePort,
  SignedAccessToken,
} from '../../domain/ports/outbound/token-service.port';

/**
 * JWT access-token adapter. Owns the single copy of the `<n><unit>` expiry
 * parsing that previously lived (duplicated) in two use cases.
 */
@Injectable()
export class JwtTokenAdapter implements ITokenServicePort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(params: {
    userId: string;
    email: string;
    roleIds: string[];
  }): Promise<SignedAccessToken> {
    const accessExpiresIn = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const expiresInSeconds = this.toSeconds(accessExpiresIn);

    const token = await this.jwtService.signAsync(
      { email: params.email, roleIds: params.roleIds },
      {
        expiresIn: expiresInSeconds,
        subject: params.userId,
        // Pin algorithm so it cannot be downgraded by an attacker who
        // controls the secret transport. Mirrors `JwtStrategy.algorithms`.
        algorithm: 'HS256',
      },
    );

    return { token, expiresInSeconds };
  }

  refreshTtlMs(): number {
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    return this.toSeconds(refreshExpiresIn) * 1000;
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

  async verifyPasswordChangeToken(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        scope: string;
      }>(token, { algorithms: ['HS256'] });
      if (payload.scope !== 'password_change') return null;
      return payload.sub;
    } catch {
      return null;
    }
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
