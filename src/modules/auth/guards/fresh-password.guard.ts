import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../core/access/actions.enum';
import { AuthService } from '../auth.service';

/**
 * Step-up authentication guard for sensitive self-service security actions
 * (enabling/confirming/disabling 2FA). Requires the caller to have confirmed
 * their password recently — the same control GitHub/Google/Laravel-Fortify
 * apply so a stolen access token cannot silently alter a user's MFA.
 *
 * Runs AFTER `JwtAuthGuard` (which populates `req.user`). When the password
 * has not been confirmed inside the window, responds `403` so the client
 * redirects to `POST /auth/user/confirm-password` and retries.
 */
@Injectable()
export class FreshPasswordGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const { confirmed } = await this.authService.getPasswordConfirmationStatus(
      req.user.id,
    );
    if (!confirmed) {
      throw new ForbiddenException(
        'Password confirmation required. Confirm your password via ' +
          'POST /auth/user/confirm-password and retry.',
      );
    }

    return true;
  }
}
