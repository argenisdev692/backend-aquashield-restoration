import { Inject, Injectable } from '@nestjs/common';
import {
  createMongoAbility,
  type MongoQuery,
  type RawRuleOf,
} from '@casl/ability';
import { CacheService } from '../../shared/cache/cache.service';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { LoggerService } from '../../logger/logger.service';
import {
  type AppAbility,
  type AuthenticatedUser,
  Action,
  type Subjects,
} from './actions.enum';
import {
  type IPermissionRepository,
  PERMISSION_REPOSITORY,
} from './permission.repository';

type AppRule = RawRuleOf<AppAbility>;

/**
 * Single source of truth for authorization.
 *
 * Aggregates role grants then applies per-user overrides (a DENY in
 * `user_permissions` always wins via `inverted`). The computed rule set is
 * cached in Redis per user; the ability is rebuilt from the rules on hit.
 */
@Injectable()
export class CaslAbilityFactory {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly repo: IPermissionRepository,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CaslAbilityFactory.name);
  }

  async createForUser(user: AuthenticatedUser): Promise<AppAbility> {
    // super-admin bypass — single `manage all` rule, no DB hit, no cache
    // round-trip. JWT carries lowercase role names (`super-admin` is the
    // canonical seeded system role). Absent for legacy tokens, in which
    // case we fall through to the regular DB-backed path.
    //
    // `'all'` (lowercase) is the CASL subject wildcard — matches every
    // subject. `'ALL'` would be a literal subject named ALL and would NOT
    // grant access to other subjects. Cast through `unknown` because the
    // `Subjects` union is the typed catalog, while `'all'` is CASL-internal.
    if (user.roleNames?.includes('super-admin')) {
      return createMongoAbility<AppAbility>([
        {
          action: Action.Manage,
          subject: 'all' as unknown as Subjects,
        },
      ]);
    }

    const cacheKey = `casl:ability:${user.id}`;
    const cached = await this.cache.get<AppRule[]>(cacheKey);
    if (cached) {
      return createMongoAbility<AppAbility>(cached);
    }

    const rules: AppRule[] = [];

    const rolePerms = await this.repo.getPermissionsForRoles(user.roleIds);
    for (const p of rolePerms) {
      rules.push(this.toRule(p, user, false));
    }

    const directPerms = await this.repo.getDirectPermissionsForUser(user.id);
    for (const p of directPerms) {
      rules.push(this.toRule(p, user, !p.isGranted));
    }

    await this.cache.set(cacheKey, rules, TTL_SECONDS.MEDIUM);
    return createMongoAbility<AppAbility>(rules);
  }

  /** Invalidate when a user's roles/permissions change. */
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`casl:ability:${userId}`);
  }

  private toRule(
    p: {
      action: string;
      subject: string;
      conditions: Record<string, unknown> | null;
      fields: string[] | null;
    },
    user: AuthenticatedUser,
    inverted: boolean,
  ): AppRule {
    return {
      action: p.action as Action,
      subject: p.subject as Subjects,
      ...(p.fields ? { fields: p.fields } : {}),
      ...(p.conditions
        ? { conditions: this.interpolate(p.conditions, user) }
        : {}),
      ...(inverted ? { inverted: true } : {}),
    };
  }

  private interpolate(
    conditions: Record<string, unknown>,
    user: AuthenticatedUser,
  ): MongoQuery {
    const json = JSON.stringify(conditions).replace(/\$\{user\.id\}/g, user.id);
    return JSON.parse(json) as MongoQuery;
  }
}
