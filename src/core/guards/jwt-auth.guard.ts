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
 * Level 1 guard — verifies the JWT and pins `userId` into CLS so logs and
 * the audit trail attribute the actor automatically.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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
