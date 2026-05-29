import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import type { AuthenticatedUser } from '../access/actions.enum';

interface JwtPayload {
  sub: string;
  email?: string;
  roleIds?: string[];
  /** Lowercase role names; absent for legacy tokens issued before phase 3. */
  roleNames?: string[];
  /** AuthSession id (auth_sessions row). Used by logout / revocation. */
  sid?: string;
  /** `true` when 2FA was satisfied during the session that issued this token. */
  tfa?: boolean;
}

/**
 * Validates the access token signature/expiry and maps the payload to the
 * `AuthenticatedUser` attached as `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
      // Pin the algorithm to prevent algorithm-confusion attacks. The
      // adapter signs with HS256; the strategy must only accept HS256.
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
