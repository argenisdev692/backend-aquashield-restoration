import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';
import { CLS_KEYS } from '../../shared/cls/cls.constants';
import type { AuthenticatedUser } from '../access/actions.enum';

/**
 * Same as JwtAuthGuard but uses the `jwt-logout` strategy which accepts
 * expired tokens. Applying this to POST /auth/logout ensures that a user
 * can always revoke their session even after the 15-min access token window.
 *
 * The token signature is still verified — only the `exp` claim is waived.
 */
@Injectable()
export class JwtLogoutGuard extends AuthGuard('jwt-logout') {
  constructor(private readonly cls: ClsService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (ok) {
      const req = context
        .switchToHttp()
        .getRequest<Request & { user?: AuthenticatedUser }>();
      if (req.user && this.cls.isActive()) {
        this.cls.set(CLS_KEYS.USER_ID, req.user.id);
      }
    }
    return ok;
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
