import { type ExecutionContext, Injectable } from '@nestjs/common';
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
 * Logout is intentionally IDEMPOTENT: a missing, malformed, or
 * wrong-signature token never blocks the request. The guard resolves the
 * principal when the Bearer token is valid (so the matching session is
 * revoked), and otherwise lets the request through with `req.user`
 * undefined — the controller then returns 204 without revoking anything.
 * This prevents the client from getting stuck "logged in" when its token is
 * already gone (cleared early) or signed by a rotated secret.
 *
 * The token signature is still verified when present — only the `exp` claim
 * is waived and an absent/invalid token is downgraded from 401 to a no-op.
 */
@Injectable()
export class JwtLogoutGuard extends AuthGuard('jwt-logout') {
  constructor(private readonly cls: ClsService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (req.user && this.cls.isActive()) {
      this.cls.set(CLS_KEYS.USER_ID, req.user.id);
    }
    // Never block logout — see class docs.
    return true;
  }

  handleRequest<TUser = AuthenticatedUser>(
    _err: unknown,
    user: TUser | false,
  ): TUser {
    // Swallow auth errors: return the principal when present, else null so
    // `req.user` is undefined and the controller treats logout as a no-op.
    return (user || null) as TUser;
  }
}
