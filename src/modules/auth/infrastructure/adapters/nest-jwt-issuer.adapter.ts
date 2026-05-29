import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type {
  AccessTokenClaims,
  IJwtIssuer,
  SignedAccessToken,
} from '../../domain/ports/jwt-issuer.port';

/**
 * Wraps @nestjs/jwt to sign and verify ACCESS tokens only. Refresh tokens are
 * opaque random strings (see `refresh-token.util.ts`).
 *
 * Algorithm is pinned to HS256 in both signing and verification — matches the
 * core JwtStrategy and prevents algorithm-confusion attacks.
 */
@Injectable()
export class NestJwtIssuerAdapter implements IJwtIssuer {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('JWT_ACCESS_SECRET') as string;
    this.expiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<SignedAccessToken> {
    // expiresIn in jsonwebtoken's types is a templated literal (`${n}m`, etc.)
    // which the @types/jsonwebtoken does not infer from a plain `string`.
    // The env-validated string is structurally valid; cast at the boundary.
    const signOpts = {
      secret: this.secret,
      algorithm: 'HS256',
      expiresIn: this.expiresIn,
    } as JwtSignOptions;

    const token = await this.jwt.signAsync(
      {
        sub: claims.sub,
        sid: claims.sid,
        tfa: claims.twoFactor,
      },
      signOpts,
    );
    // Decode without verifying to extract `exp` — cheaper than re-verifying.
    const decoded = this.jwt.decode<{ exp: number }>(token);
    return {
      token,
      expiresAt: new Date(decoded.exp * 1000),
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const payload = await this.jwt.verifyAsync<{
      sub: string;
      sid: string;
      tfa: boolean;
    }>(token, { secret: this.secret, algorithms: ['HS256'] });
    return {
      sub: payload.sub,
      sid: payload.sid,
      twoFactor: payload.tfa ?? false,
    };
  }
}
