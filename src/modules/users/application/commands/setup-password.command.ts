import type { SetupPasswordInput } from '../dtos/setup-password.dto';

export class SetupPasswordCommand {
  constructor(public readonly dto: SetupPasswordInput) {}
}
