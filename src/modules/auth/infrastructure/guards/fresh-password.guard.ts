import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../../core/access/actions.enum';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  FreshPasswordRequiredException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';

/**
 * Requires the user to have confirmed their password within the
 * FRESH_PASSWORD_WINDOW (5 minutes). Applied on sensitive operations:
 *   - regenerate backup codes
 *   - disable 2FA
 *   - unlink social provider
 *   - change email (future)
 *
 * If the user is not fresh, the controller surfaces 403 with a code the
 * frontend uses to prompt for password re-entry — same UX as Laravel's
 * `confirm.password` middleware.
 */
@Injectable()
export class FreshPasswordGuard implements CanActivate {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new ForbiddenException('Authentication required');
    }
    const account = await this.accounts.findById(req.user.id);
    if (!account) throw new UserAccountNotFoundException();

    if (!account.isFreshlyAuthenticated()) {
      throw new FreshPasswordRequiredException();
    }
    return true;
  }
}
