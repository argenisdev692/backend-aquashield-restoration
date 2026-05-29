import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../../core/access/actions.enum';

/**
 * Blocks routes when the calling token was issued mid-challenge — i.e. the
 * user provided correct credentials but has not yet entered the TOTP code.
 *
 * Stack AFTER `JwtAuthGuard` (which attaches `req.user`). Tokens with
 * `tfa: false` reach mid-challenge endpoints only: `/two-factor/verify`,
 * `/two-factor/use-backup-code`. Every other authenticated route should
 * apply this guard.
 */
@Injectable()
export class TwoFactorRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new ForbiddenException('Authentication required');
    }
    if (req.user.twoFactorSatisfied === false) {
      throw new ForbiddenException({
        code: 'AUTH_TWO_FACTOR_REQUIRED',
        message: 'Two-factor verification required to access this resource',
      });
    }
    return true;
  }
}
