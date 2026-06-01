import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import type { AuthenticatedUser } from '../access/actions.enum';

interface JwtPayload {
  sub: string;
  email?: string;
  roleIds?: string[];
  roleNames?: string[];
  sid?: string;
  tfa?: boolean;
}

/**
 * Identical to JwtStrategy but with `ignoreExpiration: true`.
 *
 * Used exclusively by JwtLogoutGuard so that POST /auth/logout succeeds even
 * when the caller's access token has already expired. The session is still
 * valid in the DB and should be revoked regardless of token age.
 */
@Injectable()
export class JwtLogoutStrategy extends PassportStrategy(Strategy, 'jwt-logout') {
  constructor(config: ConfigService) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
      algorithms: ['HS256'],
    };
    super(options);
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roleIds: payload.roleIds ?? [],
      roleNames: payload.roleNames ?? [],
      sessionId: payload.sid,
      twoFactorSatisfied: payload.tfa ?? false,
    };
  }
}
