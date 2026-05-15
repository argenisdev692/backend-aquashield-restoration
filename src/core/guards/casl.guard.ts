import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { LoggerService } from '../../logger/logger.service';
import { CaslAbilityFactory } from '../access/casl-ability.factory';
import type { AuthenticatedUser } from '../access/actions.enum';
import {
  CHECK_ABILITY,
  type RequiredRule,
} from '../decorators/check-abilities.decorator';

/**
 * Level 2 guard — enforces the `@CheckAbilities()` rules against the user's
 * DB-derived CASL ability. Deny by default: any failing rule → 403.
 * Runs AFTER `JwtAuthGuard` (fixed order, never reorder).
 */
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CaslGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules =
      this.reflector.getAllAndOverride<RequiredRule[] | undefined>(
        CHECK_ABILITY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (rules.length === 0) {
      return true; // No ability requirement declared on this route.
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!req.user) {
      throw new ForbiddenException('Authorization context missing');
    }

    const ability = await this.abilityFactory.createForUser(req.user);

    const allowed = rules.every((rule) =>
      ability.can(rule.action, rule.subject),
    );

    if (!allowed) {
      this.logger.warn('Authorization denied', {
        layer: 'guard',
        userId: req.user.id,
        rules: rules.map((r) => `${r.action}:${r.subject}`),
      });
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
