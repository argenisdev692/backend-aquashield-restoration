import { SetMetadata } from '@nestjs/common';
import type { Action, Subjects } from '../access/actions.enum';

export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_ABILITY = 'check_ability';

/**
 * Declares the CASL rule(s) a route requires. Evaluated by `CaslGuard`.
 * `@Roles()` / `@Policy()` are forbidden — always express access this way.
 */
export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY, requirements);
